import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/[...path].mjs';

test('proxy Vercel preserva bytes da foto e mantém respostas privadas sem cache', async (t) => {
  const before = process.env.BACKEND_URL;
  process.env.BACKEND_URL = 'https://backend.example';
  t.after(() => {
    if (before === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = before;
  });
  const bytes = Buffer.from([0, 255, 128, 65]);
  const makeRes = () => ({
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(n) {
      this.code = n;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  });
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(bytes, {
        headers: {
          'content-type': 'image/webp',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      }),
  );
  const image = makeRes();
  await handler(
    {
      url: '/api/media/11111111-1111-4111-8111-111111111111',
      method: 'GET',
      headers: {},
    },
    image,
  );
  assert.deepEqual(image.body, bytes);
  assert.equal(image.headers['Content-Type'], 'image/webp');
  assert.match(image.headers['Cache-Control'], /immutable/);
  // Foto de conversa: o cache privado da API é respeitado, nunca público.
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(bytes, {
        headers: {
          'content-type': 'image/webp',
          'cache-control': 'private, max-age=3600',
        },
      }),
  );
  const privateImage = makeRes();
  await handler(
    {
      url: '/api/media/22222222-2222-4222-8222-222222222222',
      method: 'GET',
      headers: {},
    },
    privateImage,
  );
  assert.equal(privateImage.headers['Cache-Control'], 'private, max-age=3600');
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response('{"user":{"name":"Teste"}}', {
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'qalbi_session=test; HttpOnly',
        },
      }),
  );
  const account = makeRes();
  await handler(
    {
      url: '/api/auth/me',
      method: 'GET',
      headers: { cookie: 'qalbi_session=test' },
    },
    account,
  );
  assert.equal(account.headers['Cache-Control'], 'no-store');
  assert.equal(
    account.headers['Set-Cookie'][0],
    'qalbi_session=test; HttpOnly',
  );
  assert.equal(typeof account.body, 'string');
});

test('proxy Vercel só encaminha o IP do visitante quando há segredo configurado', async (t) => {
  const before = {
    url: process.env.BACKEND_URL,
    secret: process.env.PROXY_SECRET,
  };
  process.env.BACKEND_URL = 'https://backend.example';
  t.after(() => {
    process.env.BACKEND_URL = before.url ?? '';
    if (before.secret === undefined) delete process.env.PROXY_SECRET;
    else process.env.PROXY_SECRET = before.secret;
  });
  const seen = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    seen.push(init.headers);
    return new Response('{}', {
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-1' },
    });
  });
  const makeRes = () => ({
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status() {
      return this;
    },
    send() {
      return this;
    },
  });
  const req = {
    url: '/api/shop',
    method: 'GET',
    headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
  };
  delete process.env.PROXY_SECRET;
  await handler(req, makeRes());
  assert.equal(seen[0]['x-qalbi-client-ip'], undefined);
  process.env.PROXY_SECRET = 'segredo-local-de-teste-16';
  const res = makeRes();
  await handler(req, res);
  assert.equal(seen[1]['x-qalbi-client-ip'], '203.0.113.7');
  assert.equal(seen[1]['x-qalbi-proxy'], 'segredo-local-de-teste-16');
  assert.equal(res.headers['X-Request-Id'], 'req-1');
});
