import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { createPool } from '../src/db.mjs';
import { migrate } from '../src/migrate.mjs';
import { createApp } from '../src/app.mjs';
import { hashPassword, verifyPassword } from '../src/auth.mjs';

const database = process.env.TEST_DATABASE_URL;
if (!database)
  throw new Error(
    'Defina TEST_DATABASE_URL para um PostgreSQL dedicado chamado qalbi_test.',
  );
if (new URL(database).pathname !== '/qalbi_test')
  throw new Error('Os testes só podem usar o banco qalbi_test.');
const pool = createPool(database),
  origin = 'http://127.0.0.1:4321',
  webhookSecret = 'whsec_local_test_only';
let server, base, alice, bob, admin;
const sessions = new Map(),
  signing = new Stripe('sk_test_local_only');
const fakeStripe = {
  webhooks: signing.webhooks,
  checkout: {
    sessions: {
      create: async (data, { idempotencyKey }) => {
        if (!sessions.has(idempotencyKey))
          sessions.set(idempotencyKey, {
            ...data,
            id: `cs_test_${randomUUID().replaceAll('-', '')}`,
            url: 'https://checkout.stripe.com/test',
            status: 'open',
            amount_total: data.line_items.reduce(
              (n, l) => n + l.quantity * l.price_data.unit_amount,
              0,
            ),
            currency: 'eur',
            payment_intent: `pi_${randomUUID()}`,
          });
        return sessions.get(idempotencyKey);
      },
      retrieve: async (id) => [...sessions.values()].find((s) => s.id === id),
      expire: async (id) => {
        const s = [...sessions.values()].find((s) => s.id === id);
        s.status = 'expired';
        return s;
      },
    },
  },
};
async function call(path, method = 'GET', body, cookie, extra = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      origin,
      'X-Qalbi-Request': '1',
      ...(cookie ? { cookie } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get('set-cookie')?.split(';')[0],
  };
}
async function register(name) {
  const result = await call('/api/auth/register', 'POST', {
    name,
    email: `${name.toLowerCase()}@example.test`,
    password: 'a-strong-test-password-2026',
  });
  assert.equal(result.status, 201);
  return { cookie: result.cookie, ...result.data.user };
}
const address = {
  name: 'Pessoa de teste',
  line1: 'Rua de teste 1',
  city: 'Málaga',
  postal_code: '29001',
  country: 'ES',
};
async function product(stock = 5) {
  const result = await call(
    '/api/admin/products',
    'POST',
    {
      title: 'Peça somente de teste',
      description: 'Produto fictício exclusivo do teste automatizado.',
      category: 'Bordado',
      image_url: '/shop/embroidery.jpg',
      price_cents: 2500,
      kind: 'ready',
      stock,
      lead_days: 7,
      active: true,
    },
    admin.cookie,
  );
  assert.equal(result.status, 201);
  return result.data.product;
}
async function order(user, p, key = randomUUID()) {
  return call(
    '/api/orders',
    'POST',
    {
      request_key: key,
      address,
      brief: '',
      items: [{ product_id: p.id, quantity: 1 }],
    },
    user.cookie,
  );
}
async function webhook(event) {
  const payload = JSON.stringify(event),
    signature = signing.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });
  const res = await fetch(base + '/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body: payload,
  });
  return res.status;
}
before(async () => {
  await migrate(pool);
  await pool.query(
    'TRUNCATE users,products,sessions,orders,order_items,messages,order_events,stripe_events,rate_limits RESTART IDENTITY CASCADE',
  );
  const app = createApp(
    pool,
    {
      FRONTEND_URL: origin,
      NODE_ENV: 'test',
      SHIPPING_CENTS: 500,
      countries: ['ES'],
      STRIPE_WEBHOOK_SECRET: webhookSecret,
    },
    fakeStripe,
  );
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  alice = await register('Alice');
  bob = await register('Bob');
  admin = await register('Admin');
  await pool.query("UPDATE users SET role='admin' WHERE id=$1", [admin.id]);
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});
test('senhas usam salt e verificação resistente a comparação direta', async () => {
  const a = await hashPassword('long-password-123'),
    b = await hashPassword('long-password-123');
  assert.notEqual(a, b);
  assert.ok(await verifyPassword('long-password-123', a));
  assert.equal(await verifyPassword('wrong', a), false);
});
test('autenticação, CSRF e papel administrativo são obrigatórios', async () => {
  assert.equal((await call('/api/orders')).status, 401);
  assert.equal(
    (await call('/api/admin/products', 'GET', undefined, alice.cookie)).status,
    403,
  );
  assert.equal(
    (
      await call('/api/auth/logout', 'POST', {}, alice.cookie, {
        origin: 'https://attacker.example',
      })
    ).status,
    403,
  );
});
test('preços são do servidor e chave idempotente não duplica reserva', async () => {
  const p = await product(),
    key = randomUUID();
  const a = await order(alice, p, key),
    b = await order(alice, p, key);
  assert.equal(a.status, 201);
  assert.equal(a.data.order.id, b.data.order.id);
  assert.equal(a.data.order.total_cents, 3000);
  assert.equal(
    (await pool.query('SELECT stock FROM products WHERE id=$1', [p.id])).rows[0]
      .stock,
    4,
  );
  const conflict = await call(
    '/api/orders',
    'POST',
    { request_key: key, address, items: [{ product_id: p.id, quantity: 2 }] },
    alice.cookie,
  );
  assert.equal(conflict.status, 409);
  await call(`/api/orders/${a.data.order.id}/cancel`, 'POST', {}, alice.cookie);
});
test('última unidade não pode ser reservada por dois compradores', async () => {
  const p = await product(1);
  const results = await Promise.all([order(alice, p), order(bob, p)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const winner = results.find((r) => r.status === 201).data.order;
  await call(
    `/api/orders/${winner.id}/cancel`,
    'POST',
    {},
    winner.user_id === alice.id ? alice.cookie : bob.cookie,
  );
  assert.equal(
    (await pool.query('SELECT stock FROM products WHERE id=$1', [p.id])).rows[0]
      .stock,
    1,
  );
});
test('pedidos e conversas de outro cliente não são acessíveis', async () => {
  const p = await product(),
    o = (await order(alice, p)).data.order;
  assert.equal(
    (await call(`/api/orders/${o.id}`, 'GET', undefined, bob.cookie)).status,
    404,
  );
  assert.equal(
    (
      await call(
        `/api/orders/${o.id}/messages`,
        'POST',
        { body: 'Intrusão' },
        bob.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        `/api/orders/${o.id}/messages`,
        'POST',
        { body: 'Minha pergunta' },
        alice.cookie,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await call(
        `/api/orders/${o.id}/messages`,
        'POST',
        { body: 'Resposta do atelier' },
        admin.cookie,
      )
    ).status,
    201,
  );
  assert.equal(
    (await call(`/api/orders/${o.id}`, 'GET', undefined, alice.cookie)).data
      .messages.length,
    2,
  );
  await call(`/api/orders/${o.id}/cancel`, 'POST', {}, alice.cookie);
});
test('webhook assinado confirma uma vez; preço divergente e assinatura falsa não pagam', async () => {
  const p = await product(),
    o = (await order(alice, p)).data.order;
  assert.equal(
    (await call(`/api/orders/${o.id}/checkout`, 'POST', {}, alice.cookie))
      .status,
    200,
  );
  const session = sessions.get(`qalbi-checkout-${o.id}`);
  const event = {
    id: `evt_${randomUUID()}`,
    type: 'checkout.session.completed',
    data: {
      object: { ...session, payment_status: 'paid', status: 'complete' },
    },
  };
  const fake = await fetch(base + '/webhooks/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 'fake' },
    body: JSON.stringify(event),
  });
  assert.equal(fake.status, 400);
  assert.equal(
    await webhook({
      ...event,
      id: `evt_${randomUUID()}`,
      data: { object: { ...event.data.object, amount_total: 1 } },
    }),
    409,
  );
  assert.equal(await webhook(event), 200);
  assert.equal(await webhook(event), 200);
  const detail = (
    await call(`/api/orders/${o.id}`, 'GET', undefined, alice.cookie)
  ).data;
  assert.equal(detail.order.payment_status, 'paid');
  assert.equal(detail.order.status, 'confirmed');
  assert.equal(
    detail.events.filter((e) => e.description.startsWith('Pago confirmado'))
      .length,
    1,
  );
  assert.equal(
    (await call(`/api/orders/${o.id}/cancel`, 'POST', {}, alice.cookie)).status,
    409,
  );
  assert.equal(
    (
      await call(
        `/api/admin/orders/${o.id}`,
        'PATCH',
        { status: 'completed', due_at: null, tracking: '' },
        admin.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        `/api/admin/orders/${o.id}`,
        'PATCH',
        { status: 'in_progress', due_at: '2030-01-01', tracking: '' },
        admin.cookie,
      )
    ).status,
    200,
  );
});
test('encomenda recebe orçamento administrativo antes de liberar checkout', async () => {
  const result = await call(
    '/api/orders/custom',
    'POST',
    {
      request_key: randomUUID(),
      address,
      brief: 'Gostaria de um bordado personalizado para presentear.',
    },
    bob.cookie,
  );
  assert.equal(result.status, 201);
  const id = result.data.order.id;
  assert.equal(
    (await call(`/api/orders/${id}/checkout`, 'POST', {}, bob.cookie)).status,
    409,
  );
  assert.equal(
    (
      await call(
        `/api/admin/orders/${id}/quote`,
        'POST',
        { total_cents: 5000, due_at: '2030-01-01' },
        alice.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/api/admin/orders/${id}/quote`,
        'POST',
        { total_cents: 5000, due_at: '2030-01-01' },
        admin.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(`/api/orders/${id}/checkout`, 'POST', {}, bob.cookie)).status,
    200,
  );
});
test('expiração e cancelamento devolvem estoque uma única vez', async () => {
  const p = await product(1),
    o = (await order(alice, p)).data.order;
  await call(`/api/orders/${o.id}/checkout`, 'POST', {}, alice.cookie);
  const session = sessions.get(`qalbi-checkout-${o.id}`);
  const event = {
    id: `evt_${randomUUID()}`,
    type: 'checkout.session.expired',
    data: { object: { ...session, status: 'expired' } },
  };
  assert.equal(await webhook(event), 200);
  assert.equal(await webhook(event), 200);
  assert.equal(
    (await call(`/api/orders/${o.id}/cancel`, 'POST', {}, alice.cookie)).status,
    200,
  );
  assert.equal(
    (await pool.query('SELECT stock FROM products WHERE id=$1', [p.id])).rows[0]
      .stock,
    1,
  );
});
test('reservas sem tentativa de pagamento expiram; pagamentos incertos ficam protegidos', async () => {
  const { expireUnstartedOrders } = await import('../src/maintenance.mjs');
  const p = await product(2),
    a = (await order(alice, p)).data.order,
    b = (await order(bob, p)).data.order;
  await pool.query(
    "UPDATE orders SET checkout_expires_at=now()-interval '1 hour' WHERE id=ANY($1::uuid[])",
    [[a.id, b.id]],
  );
  await pool.query("UPDATE orders SET payment_status='pending' WHERE id=$1", [
    b.id,
  ]);
  await expireUnstartedOrders(pool);
  assert.equal(
    (await pool.query('SELECT status FROM orders WHERE id=$1', [a.id])).rows[0]
      .status,
    'cancelled',
  );
  assert.equal(
    (await pool.query('SELECT status FROM orders WHERE id=$1', [b.id])).rows[0]
      .status,
    'awaiting_payment',
  );
  assert.equal(
    (await pool.query('SELECT stock FROM products WHERE id=$1', [p.id])).rows[0]
      .stock,
    1,
  );
});
test('reconciliação consulta Stripe e recusa sessão de outro pedido', async () => {
  const p = await product(2);
  const a = (await order(alice, p)).data.order;
  const b = (await order(bob, p)).data.order;
  await call(`/api/orders/${a.id}/checkout`, 'POST', {}, alice.cookie);
  const session = sessions.get(`qalbi-checkout-${a.id}`);
  // Simula Checkout criado e pago, com resposta/webhook perdidos.
  await pool.query('UPDATE orders SET checkout_id=NULL WHERE id=$1', [a.id]);
  session.status = 'complete';
  session.payment_status = 'paid';
  assert.equal(
    (
      await call(
        `/api/admin/orders/${a.id}/reconcile`,
        'POST',
        { session_id: session.id },
        alice.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/api/admin/orders/${b.id}/reconcile`,
        'POST',
        { session_id: session.id },
        admin.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        `/api/admin/orders/${a.id}/reconcile`,
        'POST',
        { session_id: session.id },
        admin.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        `/api/admin/orders/${a.id}/reconcile`,
        'POST',
        { session_id: session.id },
        admin.cookie,
      )
    ).status,
    200,
  );
  const detail = (
    await call(`/api/orders/${a.id}`, 'GET', undefined, alice.cookie)
  ).data;
  assert.equal(detail.order.payment_status, 'paid');
  assert.equal(
    detail.events.filter((e) => e.description.startsWith('Pago confirmado'))
      .length,
    1,
  );
});
test('edição administrativa desatualizada não sobrescreve reserva de estoque', async () => {
  const p = await product(2);
  await order(alice, p);
  const stale = await call(
    `/api/admin/products/${p.id}`,
    'PUT',
    { ...p, title: 'Novo título', expected_stock: p.stock },
    admin.cookie,
  );
  assert.equal(stale.status, 409);
  assert.equal(
    (await pool.query('SELECT stock FROM products WHERE id=$1', [p.id])).rows[0]
      .stock,
    1,
  );
  const current = await call(
    `/api/admin/products/${p.id}`,
    'PUT',
    { ...p, stock: 1, expected_stock: 1 },
    admin.cookie,
  );
  assert.equal(current.status, 200);
});
test('home: apenas admin publica, cards ocultos não vazam e versões evitam sobrescrita', async () => {
  assert.equal((await call('/api/admin/home')).status, 401);
  assert.equal(
    (await call('/api/admin/home', 'GET', undefined, alice.cookie)).status,
    403,
  );
  const original = (
    await call('/api/admin/home', 'GET', undefined, admin.cookie)
  ).data;
  const draft = structuredClone(original);
  draft.content.cards[0].title = 'Título revisado';
  draft.content.cards[1].visible = false;
  draft.content.cards.reverse();
  draft.content.photos.hero = {
    src: '/shop/panda.jpg',
    alt: 'Panda em destaque',
  };
  assert.equal(
    (await call('/api/admin/home', 'PUT', draft, alice.cookie)).status,
    403,
  );
  assert.equal(
    (
      await call(
        '/api/admin/home',
        'PUT',
        {
          ...draft,
          content: {
            ...draft.content,
            photos: {
              ...draft.content.photos,
              hero: { src: 'javascript:alert(1)', alt: 'Inválida' },
            },
          },
        },
        admin.cookie,
      )
    ).status,
    400,
  );
  const saved = await call('/api/admin/home', 'PUT', draft, admin.cookie);
  assert.equal(saved.status, 200);
  assert.equal(
    (await call('/api/admin/home', 'PUT', original, admin.cookie)).status,
    409,
  );
  const published = (await call('/api/home')).data;
  assert.equal(published.content.photos.hero.src, '/shop/panda.jpg');
  assert.equal(
    published.content.cards.length,
    draft.content.cards.filter((c) => c.visible).length,
  );
  assert.equal(published.content.cards.at(-1).title, 'Título revisado');
  assert.ok(!published.content.cards.some((c) => c.visible === false));
  const empty = {
    revision: saved.data.revision,
    content: { ...original.content, cards: [] },
  };
  const cleared = await call('/api/admin/home', 'PUT', empty, admin.cookie);
  assert.equal(cleared.status, 200);
  assert.equal((await call('/api/home')).data.content.cards.length, 0);
  await call(
    '/api/admin/home',
    'PUT',
    { ...original, revision: cleared.data.revision },
    admin.cookie,
  );
});
test('upload protegido reencoda foto e rejeita arquivos inválidos', async () => {
  const sharp = (await import('sharp')).default;
  const bytes = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#c0a090' },
  })
    .png()
    .toBuffer();
  const body = { data: bytes.toString('base64') };
  assert.equal(
    (await call('/api/admin/media', 'POST', body, alice.cookie)).status,
    403,
  );
  assert.equal(
    (
      await call(
        '/api/admin/media',
        'POST',
        { data: Buffer.from('<svg onload="alert(1)"/>').toString('base64') },
        admin.cookie,
      )
    ).status,
    400,
  );
  const uploaded = await call('/api/admin/media', 'POST', body, admin.cookie);
  assert.equal(uploaded.status, 201);
  const response = await fetch(base + uploaded.data.url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  const result = await response.arrayBuffer();
  assert.equal((await sharp(Buffer.from(result)).metadata()).format, 'webp');
  assert.match(response.headers.get('cache-control'), /immutable/);
});
test('cliente entra por email ou telefone normalizado, sem acessar o login administrativo', async () => {
  const password = 'customer-phone-password-2026';
  const registered = await call('/api/auth/register', 'POST', {
    name: 'Cliente telefone',
    email: 'phone@example.test',
    phone: '+34 (600) 123-456',
    password,
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.user.phone, '+34600123456');
  const emailLogin = await call('/api/auth/login', 'POST', {
    identifier: 'PHONE@example.test',
    password,
  });
  assert.equal(emailLogin.status, 200);
  const phoneLogin = await call(
    '/api/auth/login',
    'POST',
    { identifier: '0034 600 123 456', password },
    emailLogin.cookie,
  );
  assert.equal(phoneLogin.status, 200);
  assert.equal(phoneLogin.data.user.id, registered.data.user.id);
  assert.equal(
    (await call('/api/auth/me', 'GET', undefined, emailLogin.cookie)).status,
    401,
  );
  assert.equal(
    (
      await call('/api/auth/admin/login', 'POST', {
        email: 'phone@example.test',
        password,
      })
    ).status,
    401,
  );
  assert.equal(
    (await call('/api/auth/admin/me', 'GET', undefined, phoneLogin.cookie))
      .status,
    403,
  );
  assert.equal(
    (
      await call('/api/auth/login', 'POST', {
        identifier: '+34600123456',
        password: 'wrong-password-123',
      })
    ).status,
    401,
  );
  const duplicate = await call('/api/auth/register', 'POST', {
    name: 'Outro cliente',
    email: 'otherphone@example.test',
    phone: '0034600123456',
    password,
  });
  assert.equal(duplicate.status, 409);
  assert.equal(
    (
      await call(
        '/api/auth/contact',
        'PUT',
        { phone: '+5511999998888', password: 'wrong-password-123' },
        phoneLogin.cookie,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await call(
        '/api/auth/contact',
        'PUT',
        { phone: '+55 (11) 99999-8888', password },
        phoneLogin.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call('/api/auth/login', 'POST', {
        identifier: '+34600123456',
        password,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call('/api/auth/login', 'POST', {
        identifier: '+5511999998888',
        password,
      })
    ).status,
    200,
  );
});
test('seed admin é idempotente, não promove cliente e só entra pela rota administrativa', async () => {
  const { seedAdmin } = await import('../src/seed-admin.mjs');
  const env = {
    ADMIN_EMAIL: 'seed@example.test',
    ADMIN_PASSWORD: 'seed-only-strong-password',
    ADMIN_NAME: 'Admin seed',
  };
  assert.equal(await seedAdmin(pool, env), true);
  assert.equal(
    await seedAdmin(pool, {
      ...env,
      ADMIN_PASSWORD: 'different-password-after-boot',
    }),
    false,
  );
  assert.equal(await seedAdmin(pool, {}), false);
  await assert.rejects(
    seedAdmin(pool, { ADMIN_EMAIL: 'partial@example.test' }),
    /Configure ADMIN_EMAIL/,
  );
  await assert.rejects(
    seedAdmin(pool, { ...env, ADMIN_EMAIL: alice.email }),
    /já pertence a um cliente/,
  );
  assert.equal(
    (
      await call('/api/auth/login', 'POST', {
        identifier: env.ADMIN_EMAIL,
        password: env.ADMIN_PASSWORD,
      })
    ).status,
    401,
  );
  const login = await call('/api/auth/admin/login', 'POST', {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'admin');
  assert.equal(
    (await call('/api/auth/admin/me', 'GET', undefined, login.cookie)).status,
    200,
  );
  assert.equal(
    (await call('/api/admin/home', 'GET', undefined, login.cookie)).status,
    200,
  );
  assert.equal(
    (
      await call('/api/auth/admin/login', 'POST', {
        email: env.ADMIN_EMAIL,
        password: 'different-password-after-boot',
      })
    ).status,
    401,
  );
});
test('resumo administrativo inclui pedidos pendentes de pagamento', async () => {
  const response = await call(
    '/api/admin/orders',
    'GET',
    undefined,
    admin.cookie,
  );
  assert.equal(response.status, 200);
  const expected = (
    await pool.query(
      "SELECT count(*)::int AS count FROM orders WHERE status='awaiting_payment'",
    )
  ).rows[0].count;
  assert.equal(response.data.stats.awaiting_payment, expected);
});
