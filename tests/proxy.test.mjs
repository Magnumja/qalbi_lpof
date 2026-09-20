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
      new Response(bytes, { headers: { 'content-type': 'image/webp' } }),
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
