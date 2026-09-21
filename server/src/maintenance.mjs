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

/** Apaga registros operacionais vencidos. Pedidos, mensagens e fotos usadas ficam. */
export async function pruneExpiredRecords(pool) {
  await pool.query(
    "DELETE FROM access_links WHERE (used_at IS NOT NULL OR expires_at<now()) AND created_at<now()-interval '7 days'",
  );
  await pool.query(
    "DELETE FROM notifications WHERE sent_at<now()-interval '30 days' OR (sent_at IS NULL AND attempts>=5 AND created_at<now()-interval '30 days')",
  );
  // Foto enviada à conversa mas nunca anexada a uma mensagem.
  await pool.query(
    "DELETE FROM media m WHERE m.order_id IS NOT NULL AND m.created_at<now()-interval '24 hours' AND NOT EXISTS (SELECT 1 FROM messages WHERE media_id=m.id)",
  );
}
