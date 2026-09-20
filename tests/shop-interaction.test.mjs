import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileCart } from '../src/components/shop/cart.ts';
import { api, ApiError } from '../src/components/shop/api.ts';
const products = [
  { id: 'ready', kind: 'ready', stock: 2 },
  { id: 'custom', kind: 'made_to_order', stock: 0 },
];
test('carrinho recuperado limita estoque, elimina peças ausentes e ignora valores inválidos', () => {
  assert.deepEqual(
    reconcileCart({ ready: 9, custom: 25, missing: 1 }, products),
    { ready: 2, custom: 20 },
  );
  assert.deepEqual(reconcileCart({ ready: NaN, custom: '2' }, products), {});
  assert.deepEqual(reconcileCart(null, products), {});
  assert.deepEqual(reconcileCart({ ready: 1.8 }, products), { ready: 1 });
});
test('falhas de conexão e respostas HTML oferecem uma mensagem compreensível', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(
    api('/orders'),
    (err) => err instanceof ApiError && err.message.includes('Mis pedidos'),
  );
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('<html>Unavailable</html>', { status: 502 }),
  );
  await assert.rejects(
    api('/orders'),
    (err) =>
      err instanceof ApiError &&
      err.status === 502 &&
      !err.message.includes('JSON'),
  );
});
