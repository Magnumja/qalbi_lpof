import { transaction } from './db.mjs';
import { releaseInventory, addEvent } from './orders.mjs';

/** Só libera reservas que nunca iniciaram uma tentativa de pagamento. */
export async function expireUnstartedOrders(pool) {
  await transaction(pool, async (db) => {
    const { rows } = await db.query(
      "SELECT * FROM orders WHERE kind='shop' AND status='awaiting_payment' AND payment_status='unpaid' AND checkout_id IS NULL AND checkout_expires_at<now() ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED",
    );
    for (const order of rows) {
      await releaseInventory(db, order);
      await db.query(
        "UPDATE orders SET status='cancelled',updated_at=now() WHERE id=$1",
        [order.id],
      );
      await addEvent(
        db,
        order.id,
        null,
        'La reserva sin pago ha caducado. Puedes crear otro pedido.',
      );
    }
  });
}
