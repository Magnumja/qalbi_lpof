import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  authenticate,
  adminOnly,
  hashPassword,
  verifyPassword,
  startSession,
  sessionToken,
  tokenHash,
  rateLimit,
} from './auth.mjs';
import {
  registration,
  credentials,
  loginSchema,
  phoneSchema,
  productSchema,
  orderSchema,
  customSchema,
  quoteSchema,
  progressSchema,
  messageSchema,
  uuid,
} from './schemas.mjs';
import { accessibleOrder, createOrder, addEvent } from './orders.mjs';
import { createPayments } from './payments.mjs';
import { transaction } from './db.mjs';
import { HttpError, requireValue } from './errors.mjs';
import { publicHomeRoutes, adminHomeRoutes } from './home.mjs';

export function createApp(pool, config, stripeClient) {
  const app = express();
  const payments = createPayments(pool, config, stripeClient);
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Request-Id', randomUUID());
    next();
  });
  app.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  // Assinatura precisa do corpo original. Esta rota vem antes de express.json.
  app.post(
    '/webhooks/stripe',
    express.raw({ type: 'application/json', limit: '256kb' }),
    async (req, res) => {
      requireValue(
        payments.stripe && config.STRIPE_WEBHOOK_SECRET,
        503,
        'Webhook no configurado.',
      );
      let event;
      try {
        event = payments.stripe.webhooks.constructEvent(
          req.body,
          req.headers['stripe-signature'],
          config.STRIPE_WEBHOOK_SECRET,
        );
      } catch {
        throw new HttpError(400, 'Firma inválida.');
      }
      await payments.receive(event);
      res.json({ received: true });
    },
  );
  app.use('/api/admin/media', express.json({ limit: '1mb' }));
  app.use('/api/admin/home', express.json({ limit: '192kb' }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      requireValue(
        req.headers.origin === config.FRONTEND_URL &&
          req.headers['x-qalbi-request'] === '1',
        403,
        'Solicitud no autorizada.',
      );
    }
    next();
  });
  publicHomeRoutes(app, pool);
  app.get('/api/shop', async (_req, res) => {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE active ORDER BY created_at DESC LIMIT 200',
    );
    res.json({
      products: rows,
      currency: 'eur',
      shipping_cents: config.SHIPPING_CENTS,
      countries: config.countries,
      payment_enabled: !!payments.stripe,
    });
  });
  app.post('/api/auth/register', async (req, res) => {
    const input = registration.parse(req.body);
    await rateLimit(pool, `register:${req.ip}`, 15);
    await rateLimit(pool, `register-email:${input.email}`, 5);
    const password = await hashPassword(input.password);
    let user;
    try {
      user = (
        await pool.query(
          'INSERT INTO users(name,email,phone,password_hash) VALUES($1,$2,$3,$4) RETURNING id,name,email,phone,role',
          [input.name, input.email, input.phone ?? null, password],
        )
      ).rows[0];
    } catch (error) {
      if (error.code === '23505')
        throw new HttpError(
          409,
          'No se pudo crear la cuenta. Si ya tienes una, inicia sesión.',
        );
      throw error;
    }
    await startSession(pool, res, user.id, config);
    res.status(201).json({ user });
  });
  // Hash falso iguala o custo do login mesmo quando a conta não existe.
  const dummyPassword = hashPassword(randomUUID());
  async function login(req, res, role) {
    const input =
      role === 'admin'
        ? credentials.parse(req.body)
        : loginSchema.parse(req.body);
    const identifier = role === 'admin' ? input.email : input.identifier;
    await rateLimit(pool, `login:${req.ip}`, 100);
    await rateLimit(pool, `login-identifier:${identifier}`, 15);
    const user = (
      await pool.query(
        'SELECT * FROM users WHERE (email=$1 OR phone=$1) AND role=$2',
        [identifier, role],
      )
    ).rows[0];
    const valid = await verifyPassword(
      input.password,
      user?.password_hash ?? (await dummyPassword),
    );
    requireValue(user && valid, 401, 'Contacto o contraseña incorrectos.');
    // Trocar de conta revoga a sessão anterior deste navegador.
    const previous = sessionToken(req);
    if (previous)
      await pool.query('DELETE FROM sessions WHERE token_hash=$1', [
        tokenHash(previous),
      ]);
    await startSession(pool, res, user.id, config);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  }
  app.post('/api/auth/login', (req, res) => login(req, res, 'customer'));
  app.post('/api/auth/admin/login', (req, res) => login(req, res, 'admin'));
  app.use('/api', authenticate(pool));
  app.get('/api/auth/admin/me', adminOnly, (req, res) =>
    res.json({ user: req.user }),
  );
  app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));
  app.post('/api/auth/logout', async (req, res) => {
    await pool.query('DELETE FROM sessions WHERE token_hash=$1', [
      tokenHash(sessionToken(req)),
    ]);
    res.clearCookie('qalbi_session', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
    });
    res.json({ ok: true });
  });
  app.post('/api/auth/password', async (req, res) => {
    const input = z
      .object({
        current: z.string().max(128),
        password: z.string().min(12).max(128),
      })
      .parse(req.body);
    await rateLimit(pool, `password:${req.user.id}`, 10);
    const stored = (
      await pool.query('SELECT password_hash FROM users WHERE id=$1', [
        req.user.id,
      ])
    ).rows[0];
    requireValue(
      await verifyPassword(input.current, stored.password_hash),
      401,
      'Contraseña actual incorrecta.',
    );
    const hash = await hashPassword(input.password);
    await transaction(pool, async (db) => {
      await db.query('UPDATE users SET password_hash=$2 WHERE id=$1', [
        req.user.id,
        hash,
      ]);
      await db.query('DELETE FROM sessions WHERE user_id=$1', [req.user.id]);
    });
    await startSession(pool, res, req.user.id, config);
    res.json({ ok: true });
  });
  app.put('/api/auth/contact', async (req, res) => {
    requireValue(
      req.user.role === 'customer',
      403,
      'Solo disponible para clientes.',
    );
    const input = z
      .object({
        phone: phoneSchema.nullable(),
        password: z.string().min(12).max(128),
      })
      .parse(req.body);
    await rateLimit(pool, `contact:${req.user.id}`, 10);
    const stored = (
      await pool.query('SELECT password_hash FROM users WHERE id=$1', [
        req.user.id,
      ])
    ).rows[0];
    requireValue(
      await verifyPassword(input.password, stored.password_hash),
      401,
      'Contraseña incorrecta.',
    );
    try {
      await pool.query('UPDATE users SET phone=$2 WHERE id=$1', [
        req.user.id,
        input.phone,
      ]);
    } catch (error) {
      if (error.code === '23505')
        throw new HttpError(409, 'Este teléfono no está disponible.');
      throw error;
    }
    res.json({ phone: input.phone });
  });
  app.get('/api/orders', async (req, res) => {
    const { rows } = await pool.query(
      'SELECT o.*,u.name AS customer_name FROM orders o JOIN users u ON o.user_id=u.id WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 100',
      [req.user.id],
    );
    res.json({ orders: rows });
  });
  app.post('/api/orders', async (req, res) => {
    await rateLimit(pool, `order:${req.user.id}`, 20, 3600);
    res.status(201).json({
      order: await createOrder(
        pool,
        req.user,
        orderSchema.parse(req.body),
        'shop',
        config,
      ),
    });
  });
  app.post('/api/orders/custom', async (req, res) => {
    await rateLimit(pool, `order:${req.user.id}`, 20, 3600);
    res.status(201).json({
      order: await createOrder(
        pool,
        req.user,
        customSchema.parse(req.body),
        'custom',
        config,
      ),
    });
  });
  app.get('/api/orders/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      order = await accessibleOrder(pool, id, req.user);
    const [items, messages, events] = await Promise.all([
      pool.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id', [
        id,
      ]),
      pool.query(
        `SELECT * FROM (SELECT m.id,m.body,m.created_at,u.name AS sender_name,u.role AS sender_role FROM messages m JOIN users u ON u.id=m.sender_id WHERE order_id=$1 ORDER BY m.created_at DESC LIMIT 200) recent ORDER BY created_at`,
        [id],
      ),
      pool.query(
        'SELECT description,created_at FROM order_events WHERE order_id=$1 ORDER BY created_at DESC LIMIT 100',
        [id],
      ),
    ]);
    res.json({
      order,
      items: items.rows,
      messages: messages.rows,
      events: events.rows,
    });
  });
  app.post('/api/orders/:id/messages', async (req, res) => {
    const id = uuid.parse(req.params.id),
      { body } = messageSchema.parse(req.body);
    await accessibleOrder(pool, id, req.user);
    await rateLimit(pool, `message:${req.user.id}`, 30, 60);
    await pool.query(
      'INSERT INTO messages(order_id,sender_id,body) VALUES($1,$2,$3)',
      [id, req.user.id, body],
    );
    res.status(201).json({ ok: true });
  });
  app.post('/api/orders/:id/checkout', async (req, res) => {
    await rateLimit(pool, `checkout:${req.user.id}`, 20, 900);
    res.json({
      url: await payments.checkout(uuid.parse(req.params.id), req.user),
    });
  });
  app.post('/api/orders/:id/cancel', async (req, res) => {
    await payments.cancel(uuid.parse(req.params.id), req.user);
    res.json({ ok: true });
  });
  app.use('/api/admin', adminOnly);
  adminHomeRoutes(app, pool);
  app.post('/api/admin/orders/:id/reconcile', async (req, res) => {
    const sessionId = z
      .string()
      .regex(/^cs_[a-zA-Z0-9_]+$/)
      .max(255)
      .parse(req.body?.session_id);
    await payments.reconcile(uuid.parse(req.params.id), req.user, sessionId);
    res.json({ ok: true });
  });
  app.get('/api/admin/orders', async (req, res) => {
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(req.query.page ?? 0);
    const { rows } = await pool.query(
      `SELECT o.*,u.name AS customer_name FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 50 OFFSET $1`,
      [page * 50],
    );
    const stats = (
      await pool.query(
        `SELECT count(*) FILTER(WHERE status='requested')::int AS requested,count(*) FILTER(WHERE status='awaiting_payment')::int AS awaiting_payment,count(*) FILTER(WHERE status IN ('confirmed','in_progress','ready'))::int AS active,count(*) FILTER(WHERE due_at<current_date AND status NOT IN ('completed','cancelled','shipped'))::int AS overdue FROM orders`,
      )
    ).rows[0];
    res.json({ orders: rows, stats });
  });
  app.get('/api/admin/products', async (_req, res) =>
    res.json({
      products: (
        await pool.query(
          'SELECT * FROM products ORDER BY created_at DESC LIMIT 500',
        )
      ).rows,
    }),
  );
  app.post('/api/admin/products', async (req, res) => {
    const p = productSchema.parse(req.body);
    const row = (
      await pool.query(
        'INSERT INTO products(title,description,category,image_url,price_cents,kind,stock,lead_days,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [
          p.title,
          p.description,
          p.category,
          p.image_url,
          p.price_cents,
          p.kind,
          p.stock,
          p.lead_days,
          p.active,
        ],
      )
    ).rows[0];
    res.status(201).json({ product: row });
  });
  app.put('/api/admin/products/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      p = productSchema
        .extend({ expected_stock: z.number().int().min(0) })
        .parse(req.body);
    const row = (
      await pool.query(
        'UPDATE products SET title=$2,description=$3,category=$4,image_url=$5,price_cents=$6,kind=$7,stock=$8,lead_days=$9,active=$10 WHERE id=$1 AND stock=$11 RETURNING *',
        [
          id,
          p.title,
          p.description,
          p.category,
          p.image_url,
          p.price_cents,
          p.kind,
          p.stock,
          p.lead_days,
          p.active,
          p.expected_stock,
        ],
      )
    ).rows[0];
    requireValue(
      row,
      409,
      'El stock cambió o la pieza no existe. Actualiza la página antes de editar.',
    );
    res.json({ product: row });
  });
  app.post('/api/admin/orders/:id/quote', async (req, res) => {
    const id = uuid.parse(req.params.id),
      input = quoteSchema.parse(req.body);
    requireValue(
      input.due_at >= new Date().toISOString().slice(0, 10),
      400,
      'El plazo debe ser futuro.',
    );
    await transaction(pool, async (db) => {
      const order = await accessibleOrder(db, id, req.user, true);
      requireValue(
        order.kind === 'custom' && order.status === 'requested',
        409,
        'Este encargo ya tiene presupuesto.',
      );
      await db.query(
        "UPDATE orders SET total_cents=$2,due_at=$3,status='awaiting_payment',checkout_expires_at=date_trunc('second',now())+interval '60 minutes',updated_at=now() WHERE id=$1",
        [id, input.total_cents, input.due_at],
      );
      await db.query(
        'INSERT INTO order_items(order_id,title,price_cents,quantity) VALUES($1,$2,$3,1)',
        [id, 'Encargo personalizado', input.total_cents],
      );
      await addEvent(
        db,
        id,
        req.user.id,
        'Presupuesto disponible. Incluye el envío.',
      );
    });
    res.json({ ok: true });
  });
  app.patch('/api/admin/orders/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      input = progressSchema.parse(req.body);
    const stages = [
      'confirmed',
      'in_progress',
      'ready',
      'shipped',
      'completed',
    ];
    await transaction(pool, async (db) => {
      const order = await accessibleOrder(db, id, req.user, true);
      requireValue(
        order.payment_status === 'paid' && stages.includes(order.status),
        409,
        'Solo se puede preparar un pedido pagado.',
      );
      const delta = stages.indexOf(input.status) - stages.indexOf(order.status);
      requireValue(
        delta === 0 || delta === 1,
        409,
        'Avanza una etapa a la vez.',
      );
      await db.query(
        'UPDATE orders SET status=$2,due_at=$3,tracking=$4,updated_at=now() WHERE id=$1',
        [id, input.status, input.due_at, input.tracking],
      );
      await addEvent(
        db,
        id,
        req.user.id,
        `Estado: ${input.status}. Plazo: ${input.due_at ?? 'por confirmar'}.`,
      );
    });
    res.json({ ok: true });
  });
  app.use((_req, _res, next) =>
    next(new HttpError(404, 'Ruta no encontrada.')),
  );
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error: 'Revisa los datos introducidos.',
        fields: error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    if (error.status && error.status < 500)
      return res.status(error.status).json({ error: error.message });
    // Nunca registrar corpo, endereço, cookies, senha ou resposta Stripe.
    console.error(
      JSON.stringify({
        event: 'request_failed',
        request_id: res.get('X-Request-Id'),
        code: error.code ?? error.type ?? 'internal',
      }),
    );
    res.status(error.status ?? 500).json({
      error:
        error instanceof HttpError
          ? error.message
          : 'No se pudo completar la operación. Inténtalo de nuevo.',
    });
  });
  return app;
}
