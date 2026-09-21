import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import sharp from 'sharp';
import { createPool } from '../src/db.mjs';
import { migrate } from '../src/migrate.mjs';
import { createApp } from '../src/app.mjs';
import { pruneExpiredRecords } from '../src/maintenance.mjs';
import { forgetCustomer } from '../src/forget.mjs';
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
    'TRUNCATE users,products,sessions,orders,order_items,messages,order_events,order_reads,access_links,notifications,stripe_events,rate_limits RESTART IDENTITY CASCADE',
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
test('mensagens novas são contadas por pessoa e zeradas ao abrir o pedido', async () => {
  const p = await product(),
    o = (await order(alice, p)).data.order;
  const unread = async (who, path = '/api/orders') =>
    (await call(path, 'GET', undefined, who.cookie)).data.orders.find(
      (row) => row.id === o.id,
    )?.unread_count;
  assert.equal(await unread(alice), 0);
  await call(
    `/api/orders/${o.id}/messages`,
    'POST',
    { body: '¿Puede llevar otro color?' },
    alice.cookie,
  );
  // Quem escreve não vê a própria mensagem como nova.
  assert.equal(await unread(alice), 0);
  const adminList = await call(
    '/api/admin/orders',
    'GET',
    undefined,
    admin.cookie,
  );
  assert.equal(adminList.data.stats.unread, 1);
  assert.equal(await unread(admin, '/api/admin/orders'), 1);
  const detail = await call(
    `/api/orders/${o.id}`,
    'GET',
    undefined,
    admin.cookie,
  );
  assert.equal(detail.data.order.customer_email, 'alice@example.test');
  assert.equal(await unread(admin, '/api/admin/orders'), 0);
  await call(
    `/api/orders/${o.id}/messages`,
    'POST',
    { body: 'Claro, dime cuál.' },
    admin.cookie,
  );
  await call(
    `/api/orders/${o.id}/messages`,
    'POST',
    { body: 'Te enseño una muestra.' },
    admin.cookie,
  );
  assert.equal(await unread(alice), 2);
  assert.equal(await unread(bob), undefined);
  await call(`/api/orders/${o.id}`, 'GET', undefined, alice.cookie);
  assert.equal(await unread(alice), 0);
  await call(`/api/orders/${o.id}/cancel`, 'POST', {}, alice.cookie);
});
test('link de acesso do atelier é único, expira e redefine a senha do cliente', async () => {
  const carol = await register('Carol'),
    p = await product(),
    o = (await order(carol, p)).data.order;
  assert.equal(
    (
      await call(
        `/api/admin/orders/${o.id}/access-link`,
        'POST',
        {},
        carol.cookie,
      )
    ).status,
    403,
  );
  const first = await call(
    `/api/admin/orders/${o.id}/access-link`,
    'POST',
    {},
    admin.cookie,
  );
  assert.equal(first.status, 201);
  const second = await call(
    `/api/admin/orders/${o.id}/access-link`,
    'POST',
    {},
    admin.cookie,
  );
  const token = (url) => new URL(url).searchParams.get('acceso');
  assert.match(token(first.data.url), /^[a-f0-9]{64}$/);
  assert.equal(new URL(first.data.url).origin, origin);
  // Um novo link invalida o anterior ainda não usado.
  assert.equal(
    (
      await call('/api/auth/access-link', 'POST', {
        token: token(first.data.url),
        password: 'new-password-for-carol-2026',
      })
    ).status,
    410,
  );
  const redeemed = await call('/api/auth/access-link', 'POST', {
    token: token(second.data.url),
    password: 'new-password-for-carol-2026',
  });
  assert.equal(redeemed.status, 200);
  assert.equal(redeemed.data.user.id, carol.id);
  // Sessões antigas caem; o link não pode ser reutilizado.
  assert.equal(
    (await call('/api/auth/me', 'GET', undefined, carol.cookie)).status,
    401,
  );
  assert.equal(
    (await call('/api/auth/me', 'GET', undefined, redeemed.cookie)).status,
    200,
  );
  assert.equal(
    (
      await call('/api/auth/access-link', 'POST', {
        token: token(second.data.url),
        password: 'another-password-for-carol',
      })
    ).status,
    410,
  );
  assert.equal(
    (
      await call('/api/auth/login', 'POST', {
        identifier: 'carol@example.test',
        password: 'new-password-for-carol-2026',
      })
    ).status,
    200,
  );
  const expired = await call(
    `/api/admin/orders/${o.id}/access-link`,
    'POST',
    {},
    admin.cookie,
  );
  await pool.query(
    "UPDATE access_links SET expires_at=now()-interval '1 minute' WHERE used_at IS NULL",
  );
  assert.equal(
    (
      await call('/api/auth/access-link', 'POST', {
        token: token(expired.data.url),
        password: 'late-password-for-carol-2026',
      })
    ).status,
    410,
  );
  const events = (
    await call(`/api/orders/${o.id}`, 'GET', undefined, admin.cookie)
  ).data.events;
  assert.ok(events.some((e) => e.description.includes('enlace de acceso')));
  await call(`/api/orders/${o.id}/cancel`, 'POST', {}, redeemed.cookie);
});
test('produto aceita foto subida pelo painel', async () => {
  const media = randomUUID();
  const saved = await call(
    '/api/admin/products',
    'POST',
    {
      title: 'Peça com foto subida',
      description: 'Produto fictício exclusivo do teste automatizado.',
      category: 'Bordado',
      image_url: `/api/media/${media}`,
      price_cents: 2500,
      kind: 'made_to_order',
      stock: 0,
      lead_days: 7,
      active: false,
    },
    admin.cookie,
  );
  assert.equal(saved.status, 201);
  assert.equal(saved.data.product.image_url, `/api/media/${media}`);
  assert.equal(
    (
      await call(
        '/api/admin/products',
        'POST',
        {
          ...saved.data.product,
          image_url: 'http://insecure.example/foto.jpg',
        },
        admin.cookie,
      )
    ).status,
    400,
  );
});
test('painel filtra e ordena primeiro o que precisa do atelier', async () => {
  const dana = await register('Dana'),
    p = await product();
  const custom = (
    await call(
      '/api/orders/custom',
      'POST',
      {
        request_key: randomUUID(),
        address,
        brief: 'Encomenda de teste com detalhes suficientes para o pedido.',
      },
      dana.cookie,
    )
  ).data.order;
  const shop = (await order(dana, p)).data.order;
  await call(
    `/api/orders/${shop.id}/messages`,
    'POST',
    { body: '¿Cuándo llega?' },
    dana.cookie,
  );
  const list = async (filter) =>
    (
      await call(
        `/api/admin/orders?filter=${filter}`,
        'GET',
        undefined,
        admin.cookie,
      )
    ).data.orders;
  const all = await list('all');
  // Encomenda por orçar vem antes; depois a conversa com mensagem nova.
  assert.equal(all[0].id, custom.id);
  assert.equal(all[1].id, shop.id);
  assert.ok((await list('requested')).every((o) => o.status === 'requested'));
  assert.ok((await list('unread')).every((o) => o.unread_count > 0));
  assert.ok((await list('unread')).some((o) => o.id === shop.id));
  assert.equal(
    (
      await call(
        '/api/admin/orders?filter=drop',
        'GET',
        undefined,
        admin.cookie,
      )
    ).status,
    400,
  );
  await call(`/api/orders/${shop.id}/cancel`, 'POST', {}, dana.cookie);
  await call(`/api/orders/${custom.id}/cancel`, 'POST', {}, dana.cookie);
});
test('reembolso e disputa no Stripe refletem no pedido sem alterar estoque', async () => {
  const erin = await register('Erin'),
    p = await product(),
    o = (await order(erin, p)).data.order;
  await call(`/api/orders/${o.id}/checkout`, 'POST', {}, erin.cookie);
  const session = sessions.get(`qalbi-checkout-${o.id}`);
  assert.equal(
    await webhook({
      id: `evt_${randomUUID()}`,
      type: 'checkout.session.completed',
      data: {
        object: { ...session, payment_status: 'paid', status: 'complete' },
      },
    }),
    200,
  );
  const charge = (extra) => ({
    id: `evt_${randomUUID()}`,
    type: 'charge.refunded',
    data: {
      object: {
        id: `ch_${randomUUID()}`,
        payment_intent: session.payment_intent,
        currency: 'eur',
        ...extra,
      },
    },
  });
  assert.equal(
    await webhook(charge({ refunded: false, amount_refunded: 500 })),
    200,
  );
  let detail = (
    await call(`/api/orders/${o.id}`, 'GET', undefined, erin.cookie)
  ).data;
  assert.equal(detail.order.payment_status, 'paid');
  assert.ok(
    detail.events.some((e) => e.description.startsWith('Reembolso parcial')),
  );
  assert.equal(
    await webhook({
      id: `evt_${randomUUID()}`,
      type: 'charge.dispute.created',
      data: { object: { payment_intent: session.payment_intent } },
    }),
    200,
  );
  assert.equal(
    await webhook(charge({ refunded: true, amount_refunded: 3000 })),
    200,
  );
  detail = (await call(`/api/orders/${o.id}`, 'GET', undefined, erin.cookie))
    .data;
  assert.equal(detail.order.payment_status, 'refunded');
  assert.ok(detail.events.some((e) => e.description.startsWith('Disputa')));
  // Pagamento desconhecido é ignorado sem erro; estoque não muda.
  assert.equal(
    await webhook(charge({ payment_intent: 'pi_unknown', refunded: true })),
    200,
  );
  const stock = (
    await pool.query('SELECT stock FROM products WHERE id=$1', [p.id])
  ).rows[0].stock;
  assert.equal(stock, 4);
});
test('avisos por email: fila por evento, agrupamento de mensagens, opt-out e reenvio', async () => {
  const sent = [];
  let fail = false;
  const notifying = createApp(
    pool,
    {
      FRONTEND_URL: origin,
      NODE_ENV: 'test',
      SHIPPING_CENTS: 500,
      countries: ['ES'],
      STRIPE_WEBHOOK_SECRET: webhookSecret,
      RESEND_API_KEY: 'local-test-only',
      NOTIFY_FROM: 'Qalbi <avisos@example.test>',
    },
    fakeStripe,
    async (mail) => {
      if (fail) throw new Error('resend_500');
      sent.push(mail);
    },
  );
  const server2 = notifying.listen(0, '127.0.0.1');
  await new Promise((resolve) => server2.once('listening', resolve));
  const base2 = `http://127.0.0.1:${server2.address().port}`;
  const call2 = async (path, method = 'GET', body, cookie) => {
    const res = await fetch(base2 + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        origin,
        'X-Qalbi-Request': '1',
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  };
  const notifier = notifying.locals.notifier;
  const pending = async () =>
    (
      await pool.query(
        'SELECT kind FROM notifications WHERE sent_at IS NULL ORDER BY created_at',
      )
    ).rows.map((r) => r.kind);
  try {
    assert.equal((await call2('/api/shop')).data.notifications_enabled, true);
    assert.equal((await call('/api/shop')).data.notifications_enabled, false);
    const fay = await register('Fay');
    const custom = (
      await call2(
        '/api/orders/custom',
        'POST',
        {
          request_key: randomUUID(),
          address,
          brief: 'Encomenda para testar os avisos por email do atelier.',
        },
        fay.cookie,
      )
    ).data.order;
    // Duas mensagens do cliente geram um único aviso pendente por administrador.
    const admins = (
      await pool.query(
        "SELECT count(*)::int AS n FROM users WHERE role='admin'",
      )
    ).rows[0].n;
    for (const body of ['Hola', '¿Sigues ahí?'])
      await call2(
        `/api/orders/${custom.id}/messages`,
        'POST',
        { body },
        fay.cookie,
      );
    assert.deepEqual(await pending(), Array(admins).fill('message'));
    // Mensagem recente ainda não é entregue (janela de agrupamento).
    assert.equal(await notifier.deliverPending(), 0);
    await pool.query(
      "UPDATE notifications SET created_at=now()-interval '3 minutes'",
    );
    assert.equal(await notifier.deliverPending(), admins);
    assert.ok(sent.some((m) => m.to === 'admin@example.test'));
    assert.match(sent[0].text, new RegExp(`/admin\\?order=${custom.id}`));
    await call2(
      `/api/admin/orders/${custom.id}/quote`,
      'POST',
      { total_cents: 4000, due_at: '2030-01-01' },
      admin.cookie,
    );
    assert.deepEqual(await pending(), ['quote']);
    assert.equal(await notifier.deliverPending(), 1);
    assert.equal(sent.at(-1).to, 'fay@example.test');
    assert.match(sent.at(-1).subject, /presupuesto/);
    assert.match(sent.at(-1).text, new RegExp(`/cuenta\\?order=${custom.id}`));
    // Falha do provedor conta tentativa e mantém pendente.
    await call2(
      `/api/orders/${custom.id}/messages`,
      'POST',
      { body: 'Te enseño una muestra.' },
      admin.cookie,
    );
    await pool.query(
      "UPDATE notifications SET created_at=now()-interval '3 minutes'",
    );
    fail = true;
    assert.equal(await notifier.deliverPending(), 0);
    const failed = (
      await pool.query(
        'SELECT attempts,error FROM notifications WHERE sent_at IS NULL',
      )
    ).rows[0];
    assert.equal(failed.attempts, 1);
    assert.equal(failed.error, 'resend_500');
    fail = false;
    // A nova tentativa só acontece depois da janela de reserva de 5 minutos.
    assert.equal(await notifier.deliverPending(), 0);
    await pool.query(
      "UPDATE notifications SET claimed_at=now()-interval '6 minutes' WHERE sent_at IS NULL",
    );
    assert.equal(await notifier.deliverPending(), 1);
    // Cliente desliga os avisos: nada é enfileirado para ele.
    assert.equal(
      (
        await call2(
          '/api/auth/notifications',
          'PUT',
          { enabled: false },
          fay.cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (await call2('/api/auth/me', 'GET', undefined, fay.cookie)).data.user
        .email_notifications,
      false,
    );
    await call2(
      `/api/orders/${custom.id}/messages`,
      'POST',
      { body: 'Otra muestra.' },
      admin.cookie,
    );
    assert.deepEqual(await pending(), []);
    // Sem provedor configurado, nada é enfileirado.
    await call(
      `/api/orders/${custom.id}/messages`,
      'POST',
      { body: 'Sin proveedor' },
      fay.cookie,
    );
    assert.deepEqual(await pending(), []);
    await call2(`/api/orders/${custom.id}/cancel`, 'POST', {}, fay.cookie);
  } finally {
    await new Promise((resolve) => server2.close(resolve));
  }
});
test('foto na conversa: só participantes enviam e veem; mensagem só com foto é válida', async () => {
  const gil = await register('Gil'),
    p = await product(),
    o = (await order(gil, p)).data.order;
  const png = (
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#a0b080' },
    })
      .png()
      .toBuffer()
  ).toString('base64');
  assert.equal(
    (
      await call(
        `/api/orders/${o.id}/photos`,
        'POST',
        { data: png },
        bob.cookie,
      )
    ).status,
    404,
  );
  const photo = await call(
    `/api/orders/${o.id}/photos`,
    'POST',
    { data: png },
    gil.cookie,
  );
  assert.equal(photo.status, 201);
  assert.equal(
    (await call(`/api/orders/${o.id}/messages`, 'POST', {}, gil.cookie)).status,
    400,
  );
  assert.equal(
    (
      await call(
        `/api/orders/${o.id}/messages`,
        'POST',
        { media_id: photo.data.media_id },
        gil.cookie,
      )
    ).status,
    201,
  );
  // O admin não pode reaproveitar a foto do cliente como se fosse sua.
  assert.equal(
    (
      await call(
        `/api/orders/${o.id}/messages`,
        'POST',
        { body: 'Bonita', media_id: photo.data.media_id },
        admin.cookie,
      )
    ).status,
    400,
  );
  const detail = (
    await call(`/api/orders/${o.id}`, 'GET', undefined, admin.cookie)
  ).data;
  assert.equal(detail.messages.at(-1).media_url, photo.data.url);
  const fetchImage = (cookie) =>
    fetch(base + photo.data.url, { headers: cookie ? { cookie } : {} });
  assert.equal((await fetchImage()).status, 404);
  assert.equal((await fetchImage(bob.cookie)).status, 404);
  const seen = await fetchImage(admin.cookie);
  assert.equal(seen.status, 200);
  assert.equal(seen.headers.get('content-type'), 'image/webp');
  assert.match(seen.headers.get('cache-control'), /^private/);
  await call(`/api/orders/${o.id}/cancel`, 'POST', {}, gil.cookie);
});
test('IP do visitante só é aceito com o segredo do proxy; erros do parser são neutros', async () => {
  const guarded = createApp(
    pool,
    {
      FRONTEND_URL: origin,
      NODE_ENV: 'test',
      SHIPPING_CENTS: 500,
      countries: ['ES'],
      PROXY_SECRET: 'segredo-local-de-teste-16',
    },
    fakeStripe,
  );
  const server3 = guarded.listen(0, '127.0.0.1');
  await new Promise((resolve) => server3.once('listening', resolve));
  const base3 = `http://127.0.0.1:${server3.address().port}`;
  // Identificador distinto por tentativa: o limite testado aqui é o por IP.
  let n = 0;
  const attempt = (extra) =>
    fetch(base3 + '/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin,
        'X-Qalbi-Request': '1',
        ...extra,
      },
      body: JSON.stringify({
        identifier: `nadie${n++}@example.test`,
        password: 'password-that-does-not-exist',
      }),
    });
  try {
    await pool.query('DELETE FROM rate_limits');
    // Sem o segredo, o header de IP é ignorado: todos contam no mesmo IP local.
    for (let i = 0; i < 100; i++)
      await attempt({ 'x-qalbi-client-ip': `10.0.0.${i}` });
    assert.equal((await attempt({})).status, 429);
    // Com o segredo, um IP diferente tem seu próprio limite.
    assert.equal(
      (
        await attempt({
          'x-qalbi-proxy': 'segredo-local-de-teste-16',
          'x-qalbi-client-ip': '203.0.113.9',
        })
      ).status,
      401,
    );
    // Segredo errado volta ao IP da conexão, já bloqueado.
    assert.equal(
      (
        await attempt({
          'x-qalbi-proxy': 'segredo-errado-de-teste-16',
          'x-qalbi-client-ip': '203.0.113.10',
        })
      ).status,
      429,
    );
    await pool.query('DELETE FROM rate_limits');
    const broken = await fetch(base3 + '/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin,
        'X-Qalbi-Request': '1',
      },
      body: '{"identifier": ',
    });
    assert.equal(broken.status, 400);
    const message = (await broken.json()).error;
    assert.doesNotMatch(message, /JSON|token|Unexpected/i);
    const huge = await fetch(base3 + '/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin,
        'X-Qalbi-Request': '1',
      },
      body: JSON.stringify({ identifier: 'x'.repeat(40000), password: 'y' }),
    });
    assert.equal(huge.status, 413);
    assert.match((await huge.json()).error, /demasiado grande/);
  } finally {
    await new Promise((resolve) => server3.close(resolve));
  }
});
test('cliente não recebe campos internos do pedido; retenção apaga só registros vencidos', async () => {
  const hana = await register('Hana'),
    p = await product(),
    o = (await order(hana, p)).data.order;
  for (const key of ['request_hash', 'checkout_url', 'inventory_released'])
    assert.equal(key in o, false, key);
  const listed = (await call('/api/orders', 'GET', undefined, hana.cookie)).data
    .orders[0];
  assert.equal('checkout_id' in listed, false);
  const detail = (
    await call(`/api/orders/${o.id}`, 'GET', undefined, hana.cookie)
  ).data.order;
  assert.equal('production_days' in detail, false);
  assert.equal(detail.status, 'awaiting_payment');
  // Retenção: link usado há mais de 7 dias sai; link recente fica.
  await call(`/api/admin/orders/${o.id}/access-link`, 'POST', {}, admin.cookie);
  const recent = (
    await pool.query(
      "UPDATE access_links SET used_at=now(),created_at=now()-interval '8 days' WHERE user_id=$1 RETURNING token_hash",
      [hana.id],
    )
  ).rows.length;
  assert.equal(recent, 1);
  await call(`/api/admin/orders/${o.id}/access-link`, 'POST', {}, admin.cookie);
  const png = (
    await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer()
  ).toString('base64');
  const orphan = (
    await call(`/api/orders/${o.id}/photos`, 'POST', { data: png }, hana.cookie)
  ).data.media_id;
  const attached = (
    await call(`/api/orders/${o.id}/photos`, 'POST', { data: png }, hana.cookie)
  ).data.media_id;
  await call(
    `/api/orders/${o.id}/messages`,
    'POST',
    { media_id: attached },
    hana.cookie,
  );
  await pool.query(
    "UPDATE media SET created_at=now()-interval '2 days' WHERE id=ANY($1)",
    [[orphan, attached]],
  );
  await pruneExpiredRecords(pool);
  const links = (
    await pool.query('SELECT used_at FROM access_links WHERE user_id=$1', [
      hana.id,
    ])
  ).rows;
  assert.equal(links.length, 1);
  assert.equal(links[0].used_at, null);
  const media = (
    await pool.query('SELECT id FROM media WHERE id=ANY($1) ORDER BY id', [
      [orphan, attached],
    ])
  ).rows.map((r) => r.id);
  assert.deepEqual(media, [attached]);
  await call(`/api/orders/${o.id}/cancel`, 'POST', {}, hana.cookie);
});
test('sessões: lista, renovação por uso, encerrar as demais e aviso de novo acesso', async () => {
  const notifying = createApp(
    pool,
    {
      FRONTEND_URL: origin,
      NODE_ENV: 'test',
      SHIPPING_CENTS: 500,
      countries: ['ES'],
      RESEND_API_KEY: 'local-test-only',
      NOTIFY_FROM: 'Qalbi <avisos@example.test>',
    },
    fakeStripe,
    async () => {},
  );
  const server4 = notifying.listen(0, '127.0.0.1');
  await new Promise((resolve) => server4.once('listening', resolve));
  const base4 = `http://127.0.0.1:${server4.address().port}`;
  const call4 = async (path, method = 'GET', body, cookie, ua) => {
    const res = await fetch(base4 + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        origin,
        'X-Qalbi-Request': '1',
        ...(cookie ? { cookie } : {}),
        ...(ua ? { 'user-agent': ua } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: res.status,
      data: await res.json(),
      cookie: res.headers.get('set-cookie')?.split(';')[0],
    };
  };
  try {
    const ivy = await register('Ivy');
    const phone = await call4(
      '/api/auth/login',
      'POST',
      {
        identifier: 'ivy@example.test',
        password: 'a-strong-test-password-2026',
      },
      undefined,
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1',
    );
    assert.equal(phone.status, 200);
    const listed = (
      await call4('/api/auth/sessions', 'GET', undefined, phone.cookie)
    ).data.sessions;
    assert.equal(listed.length, 2);
    assert.equal(listed.find((x) => x.current).label, 'iPhone/iPad · Safari');
    // Aviso de novo acesso enfileirado sem pedido.
    const login = (
      await pool.query(
        "SELECT order_id FROM notifications WHERE user_id=$1 AND kind='login'",
        [ivy.id],
      )
    ).rows;
    assert.equal(login.length, 1);
    assert.equal(login[0].order_id, null);
    assert.equal(await notifying.locals.notifier.deliverPending(), 1);
    // Renovação: sessão quase vencida ganha 7 dias ao ser usada.
    await pool.query(
      "UPDATE sessions SET expires_at=now()+interval '1 hour' WHERE user_id=$1",
      [ivy.id],
    );
    await call4('/api/auth/me', 'GET', undefined, phone.cookie);
    const renewed = (
      await pool.query(
        "SELECT count(*)::int AS n FROM sessions WHERE user_id=$1 AND expires_at>now()+interval '6 days'",
        [ivy.id],
      )
    ).rows[0].n;
    assert.equal(renewed, 1);
    // Encerrar as demais mantém só a atual.
    const closed = await call4(
      '/api/auth/sessions/close-others',
      'POST',
      {},
      phone.cookie,
    );
    assert.equal(closed.data.closed, 1);
    assert.equal(
      (await call('/api/auth/me', 'GET', undefined, ivy.cookie)).status,
      401,
    );
    assert.equal(
      (await call4('/api/auth/me', 'GET', undefined, phone.cookie)).status,
      200,
    );
  } finally {
    await new Promise((resolve) => server4.close(resolve));
  }
});
test('senha presente em vazamentos é recusada no cadastro, na troca e no link de acesso', async () => {
  const guarded = createApp(
    pool,
    {
      FRONTEND_URL: origin,
      NODE_ENV: 'test',
      SHIPPING_CENTS: 500,
      countries: ['ES'],
    },
    fakeStripe,
    undefined,
    async (password) => password === 'contrasena-filtrada-2026',
  );
  const server5 = guarded.listen(0, '127.0.0.1');
  await new Promise((resolve) => server5.once('listening', resolve));
  const base5 = `http://127.0.0.1:${server5.address().port}`;
  const call5 = async (path, method, body, cookie) => {
    const res = await fetch(base5 + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        origin,
        'X-Qalbi-Request': '1',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  };
  try {
    const leaked = await call5('/api/auth/register', 'POST', {
      name: 'Jo',
      email: 'jo@example.test',
      password: 'contrasena-filtrada-2026',
    });
    assert.equal(leaked.status, 400);
    assert.match(leaked.data.error, /filtraciones/);
    assert.equal(
      (
        await call5('/api/auth/register', 'POST', {
          name: 'Jo',
          email: 'jo@example.test',
          password: 'contrasena-unica-de-jo-2026',
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await call5(
          '/api/auth/password',
          'POST',
          {
            current: 'a-strong-test-password-2026',
            password: 'contrasena-filtrada-2026',
          },
          alice.cookie,
        )
      ).status,
      400,
    );
  } finally {
    await new Promise((resolve) => server5.close(resolve));
  }
});
test('anonimização a pedido do cliente preserva o pedido sem dados pessoais', async () => {
  const kim = await register('Kim'),
    p = await product(),
    o = (await order(kim, p)).data.order;
  await call(
    `/api/orders/${o.id}/messages`,
    'POST',
    { body: 'Mi dirección es secreta.' },
    kim.cookie,
  );
  await call(`/api/orders/${o.id}/checkout`, 'POST', {}, kim.cookie);
  const session = sessions.get(`qalbi-checkout-${o.id}`);
  await webhook({
    id: `evt_${randomUUID()}`,
    type: 'checkout.session.completed',
    data: {
      object: { ...session, payment_status: 'paid', status: 'complete' },
    },
  });
  // Pedido pago em andamento bloqueia a anonimização.
  await assert.rejects(forgetCustomer(pool, 'kim@example.test'), /andamento/);
  for (const status of ['in_progress', 'ready', 'shipped', 'completed'])
    await call(
      `/api/admin/orders/${o.id}`,
      'PATCH',
      { status, due_at: null, tracking: 'ref' },
      admin.cookie,
    );
  await forgetCustomer(pool, 'kim@example.test');
  await assert.rejects(
    forgetCustomer(pool, 'kim@example.test'),
    /não encontrado/,
  );
  const user = (
    await pool.query('SELECT name,email,phone FROM users WHERE id=$1', [kim.id])
  ).rows[0];
  assert.equal(user.name, 'Cliente eliminado');
  assert.doesNotMatch(user.email, /kim/);
  assert.equal(
    (await call('/api/auth/me', 'GET', undefined, kim.cookie)).status,
    401,
  );
  const kept = (
    await call(`/api/orders/${o.id}`, 'GET', undefined, admin.cookie)
  ).data;
  assert.equal(kept.order.status, 'completed');
  assert.equal(kept.order.total_cents, 3000);
  assert.equal(kept.order.address.line1, '—');
  assert.equal(kept.order.address.country, 'ES');
  assert.equal(kept.order.tracking, '');
  assert.equal(
    kept.messages[0].body,
    '[mensaje eliminado a petición del cliente]',
  );
});

test('busca administrativa combina cliente, número, ordenação e paginação', async () => {
  const owner = await register('BuscaExclusiva');
  const first = (await order(owner, await product())).data.order;
  const second = (await order(owner, await product())).data.order;
  const list = (query, cookie = admin.cookie) =>
    call(`/api/admin/orders?${query}`, 'GET', undefined, cookie);
  const result = await list('search=buscaexclusiva&sort=newest');
  assert.equal(result.status, 200);
  assert.deepEqual(
    result.data.orders.map((o) => o.id),
    [second.id, first.id],
  );
  assert.equal(result.data.has_more, false);
  assert.equal(
    (await list(`search=%23${first.number}`)).data.orders[0].id,
    first.id,
  );
  assert.equal((await list('search=%25')).data.orders.length, 0);
  assert.equal(
    (await list('search=buscaexclusiva&page=1')).data.orders.length,
    0,
  );
  assert.equal((await list('sort=invalid')).status, 400);
  assert.equal((await list('search=' + 'x'.repeat(121))).status, 400);
  assert.equal((await list('search=busca', owner.cookie)).status, 403);
  await call(`/api/orders/${first.id}/cancel`, 'POST', {}, owner.cookie);
  const cancelled = await list('search=buscaexclusiva&filter=cancelled');
  assert.deepEqual(
    cancelled.data.orders.map((o) => o.id),
    [first.id],
  );
  await call(`/api/orders/${second.id}/cancel`, 'POST', {}, owner.cookie);
});

test('catálogo administrativo pagina e combina categoria, visibilidade e estoque', async () => {
  // Mais de uma página prova que a busca não depende das peças já carregadas.
  await pool.query(`INSERT INTO products(title,description,category,image_url,price_cents,kind,stock,lead_days,active)
    SELECT 'Catálogo QA ' || n,'Descrição exclusiva de teste','Coleção QA','/shop/embroidery.jpg',1000,'ready',0,7,false FROM generate_series(1,27) n`);
  const query =
    'category=Cole%C3%A7%C3%A3o%20QA&visibility=draft&availability=out';
  const list = (q) =>
    call('/api/admin/products?' + q, 'GET', undefined, admin.cookie);
  const first = (await list(query)).data;
  const second = (await list(query + '&page=1')).data;
  assert.equal(first.total, 27);
  assert.equal(first.products.length, 25);
  assert.equal(first.has_more, true);
  assert.equal(second.products.length, 2);
  assert.equal(second.has_more, false);
  assert.equal(
    new Set([...first.products, ...second.products].map((p) => p.id)).size,
    27,
  );
  assert.ok(first.categories.includes('Coleção QA'));
  assert.equal((await list(query + '&search=QA%2027')).data.total, 1);
  assert.equal(
    (await list('category=Cole%C3%A7%C3%A3o%20QA&visibility=published')).data
      .total,
    0,
  );
  assert.equal((await list('availability=invalid')).status, 400);
  assert.equal((await list('page=-1')).status, 400);
  assert.equal(
    (await call('/api/admin/products', 'GET', undefined, bob.cookie)).status,
    403,
  );
});
