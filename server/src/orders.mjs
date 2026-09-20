import { createHash } from 'node:crypto';
import { transaction } from './db.mjs';
import { requireValue } from './errors.mjs';

export async function accessibleOrder(db, id, user, lock = false) {
  const { rows } = await db.query(
    `SELECT o.*,u.name AS customer_name,u.email AS customer_email,u.phone AS customer_phone FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=$1 AND (o.user_id=$2 OR $3)${lock ? ' FOR UPDATE OF o' : ''}`,
    [id, user.id, user.role === 'admin'],
  );
  requireValue(rows[0], 404, 'Pedido no encontrado.');
  return rows[0];
}
// Mensagens de outras pessoas depois da última leitura desta pessoa.
export const unreadColumn = (userParam) =>
  `(SELECT count(*)::int FROM messages m WHERE m.order_id=o.id AND m.sender_id<>${userParam} AND m.created_at>COALESCE((SELECT r.read_at FROM order_reads r WHERE r.order_id=o.id AND r.user_id=${userParam}),'epoch')) AS unread_count`;
export async function markRead(db, orderId, userId) {
  await db.query(
    'INSERT INTO order_reads(order_id,user_id,read_at) VALUES($1,$2,now()) ON CONFLICT(order_id,user_id) DO UPDATE SET read_at=now()',
    [orderId, userId],
  );
}
export async function addEvent(db, id, actor, description) {
  await db.query(
    'INSERT INTO order_events(order_id,actor_id,description) VALUES($1,$2,$3)',
    [id, actor, description],
  );
}
export async function releaseInventory(db, order) {
  if (order.inventory_released) return;
  const { rows } = await db.query(
    'SELECT product_id,quantity FROM order_items WHERE order_id=$1 AND reserved_stock ORDER BY product_id',
    [order.id],
  );
  for (const item of rows)
    await db.query('UPDATE products SET stock=stock+$2 WHERE id=$1', [
      item.product_id,
      item.quantity,
    ]);
  await db.query('UPDATE orders SET inventory_released=true WHERE id=$1', [
    order.id,
  ]);
}
export async function createOrder(pool, user, input, kind, config) {
  requireValue(
    config.countries.includes(input.address.country),
    400,
    'Todavía no enviamos a ese país.',
  );
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ kind, ...input }))
    .digest('hex');
  return transaction(pool, async (db) => {
    // Serializa requisições do mesmo comprador: duplo toque não duplica pedidos.
    await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
    const old = (
      await db.query(
        'SELECT * FROM orders WHERE user_id=$1 AND request_key=$2',
        [user.id, input.request_key],
      )
    ).rows[0];
    if (old) {
      requireValue(
        old.request_hash === fingerprint,
        409,
        'Este intento ya se utilizó para otro pedido.',
      );
      return old;
    }
    const pending = (
      await db.query(
        "SELECT count(*)::int AS count FROM orders WHERE user_id=$1 AND status IN ('requested','awaiting_payment')",
        [user.id],
      )
    ).rows[0].count;
    requireValue(
      pending < 5,
      409,
      'Tienes varios pedidos pendientes. Revísalos antes de crear otro.',
    );
    let total = config.SHIPPING_CENTS,
      days = 1;
    const lines = [];
    if (kind === 'shop') {
      const quantities = new Map();
      for (const item of input.items)
        quantities.set(
          item.product_id,
          (quantities.get(item.product_id) || 0) + item.quantity,
        );
      for (const [id, quantity] of [...quantities].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        requireValue(quantity <= 20, 400, 'Máximo 20 unidades de cada pieza.');
        const product = (
          await db.query(
            'SELECT * FROM products WHERE id=$1 AND active FOR UPDATE',
            [id],
          )
        ).rows[0];
        requireValue(
          product,
          409,
          'Una pieza ya no está disponible. Actualiza la tienda.',
        );
        if (product.kind === 'ready') {
          requireValue(
            product.stock >= quantity,
            409,
            `No hay suficientes unidades de ${product.title}.`,
          );
          await db.query('UPDATE products SET stock=stock-$2 WHERE id=$1', [
            id,
            quantity,
          ]);
        }
        total += product.price_cents * quantity;
        days = Math.max(days, product.lead_days);
        lines.push({ ...product, quantity });
      }
      requireValue(
        total <= 2000000,
        400,
        'Para este importe, solicita un encargo personalizado.',
      );
    }
    const order = (
      await db.query(
        `INSERT INTO orders(user_id,request_key,request_hash,kind,status,total_cents,shipping_cents,address,brief,production_days,checkout_expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $4='shop' THEN date_trunc('second',now())+interval '60 minutes' ELSE NULL END) RETURNING *`,
        [
          user.id,
          input.request_key,
          fingerprint,
          kind,
          kind === 'shop' ? 'awaiting_payment' : 'requested',
          kind === 'shop' ? total : null,
          kind === 'shop' ? config.SHIPPING_CENTS : 0,
          input.address,
          input.brief,
          days,
        ],
      )
    ).rows[0];
    for (const line of lines)
      await db.query(
        'INSERT INTO order_items(order_id,product_id,title,price_cents,quantity,reserved_stock) VALUES($1,$2,$3,$4,$5,$6)',
        [
          order.id,
          line.id,
          line.title,
          line.price_cents,
          line.quantity,
          line.kind === 'ready',
        ],
      );
    await addEvent(
      db,
      order.id,
      user.id,
      kind === 'shop'
        ? 'Pedido creado. Pendiente de pago.'
        : 'Solicitud personalizada recibida.',
    );
    return order;
  });
}
