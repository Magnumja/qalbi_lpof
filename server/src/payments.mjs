import Stripe from 'stripe';
import { transaction } from './db.mjs';
import { accessibleOrder, addEvent, releaseInventory } from './orders.mjs';
import { requireValue } from './errors.mjs';

export function createPayments(pool, config, client, notifier) {
  const stripe =
    client ??
    (config.STRIPE_SECRET_KEY
      ? new Stripe(config.STRIPE_SECRET_KEY, {
          timeout: 15000,
          maxNetworkRetries: 1,
        })
      : null);
  async function checkout(id, user) {
    requireValue(
      stripe,
      503,
      'El pago en línea todavía no está habilitado. Tu pedido queda guardado.',
    );
    await transaction(pool, async (db) => {
      const order = await accessibleOrder(db, id, user, true);
      requireValue(
        order.user_id === user.id && order.status === 'awaiting_payment',
        409,
        'Este pedido no se puede pagar.',
      );
      if (order.payment_status === 'unpaid') {
        await db.query(
          "UPDATE orders SET payment_status='pending',checkout_expires_at=date_trunc('second',now())+interval '60 minutes' WHERE id=$1",
          [id],
        );
      }
    });
    return transaction(pool, async (db) => {
      const order = await accessibleOrder(db, id, user, true);
      requireValue(
        order.user_id === user.id,
        403,
        'Solo el comprador puede pagar este pedido.',
      );
      requireValue(
        order.status === 'awaiting_payment' && order.payment_status !== 'paid',
        409,
        'Este pedido no está pendiente de pago.',
      );
      if (order.checkout_id) {
        const session = await stripe.checkout.sessions.retrieve(
          order.checkout_id,
        );
        requireValue(
          session.status === 'open',
          409,
          'Esta sesión ya terminó. Actualiza tus pedidos.',
        );
        return session.url;
      }
      // Valor e expiração vêm do pedido persistido, nunca do navegador.
      // A chave estável permite recuperar uma resposta perdida sem criar duas cobranças.
      requireValue(
        new Date(order.checkout_expires_at).getTime() >
          Date.now() - 22 * 3600000,
        409,
        'Este pago requiere revisión del atelier. Escríbenos en la conversación del pedido.',
      );
      const items = (
        await db.query(
          'SELECT * FROM order_items WHERE order_id=$1 ORDER BY id',
          [id],
        )
      ).rows;
      const line_items =
        order.kind === 'custom'
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: order.currency,
                  unit_amount: order.total_cents,
                  product_data: { name: `Encargo Qalbi #${order.number}` },
                },
              },
            ]
          : items.map((item) => ({
              quantity: item.quantity,
              price_data: {
                currency: order.currency,
                unit_amount: item.price_cents,
                product_data: { name: item.title },
              },
            }));
      if (order.kind === 'shop' && order.shipping_cents)
        line_items.push({
          quantity: 1,
          price_data: {
            currency: order.currency,
            unit_amount: order.shipping_cents,
            product_data: { name: 'Envío' },
          },
        });
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          line_items,
          client_reference_id: id,
          metadata: { order_id: id },
          payment_intent_data: { metadata: { order_id: id } },
          customer_email: user.email,
          expires_at: Math.floor(
            new Date(order.checkout_expires_at).getTime() / 1000,
          ),
          success_url: `${config.FRONTEND_URL}/cuenta?order=${id}&payment=returned`,
          cancel_url: `${config.FRONTEND_URL}/cuenta?order=${id}`,
        },
        { idempotencyKey: `qalbi-checkout-${id}` },
      );
      await db.query(
        "UPDATE orders SET checkout_id=$2,checkout_url=$3,payment_status='pending',updated_at=now() WHERE id=$1",
        [id, session.id, session.url],
      );
      return session.url;
    });
  }
  async function receive(event) {
    await transaction(pool, async (db) => {
      // Duplicatas do webhook retornam sucesso sem repetir o processamento.
      const inserted = await db.query(
        'INSERT INTO stripe_events(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id',
        [event.id],
      );
      if (!inserted.rowCount) return;
      const session = event.data.object;
      // Reembolsos e disputas são feitos no Stripe; aqui só refletimos o estado.
      if (
        ['charge.refunded', 'charge.dispute.created'].includes(event.type) &&
        session.payment_intent
      ) {
        const order = (
          await db.query(
            'SELECT * FROM orders WHERE payment_intent=$1 FOR UPDATE',
            [session.payment_intent],
          )
        ).rows[0];
        if (!order) return;
        if (event.type === 'charge.dispute.created') {
          await addEvent(
            db,
            order.id,
            null,
            'Disputa abierta en Stripe. Revisa el caso en el panel de Stripe.',
          );
          return;
        }
        if (session.refunded === true && order.payment_status === 'paid')
          await db.query(
            "UPDATE orders SET payment_status='refunded',updated_at=now() WHERE id=$1",
            [order.id],
          );
        await addEvent(
          db,
          order.id,
          null,
          session.refunded === true
            ? 'Reembolso completo confirmado por Stripe.'
            : `Reembolso parcial en Stripe: ${((session.amount_refunded ?? 0) / 100).toFixed(2)} ${(session.currency ?? order.currency).toUpperCase()}.`,
        );
        return;
      }
      if (
        !['checkout.session.completed', 'checkout.session.expired'].includes(
          event.type,
        )
      )
        return;
      const id = session.metadata?.order_id;
      if (!id) return;
      const order = (
        await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      requireValue(order, 409, 'No se encontró el pedido asociado al pago.');
      requireValue(
        !order.checkout_id || order.checkout_id === session.id,
        409,
        'La sesión de pago no coincide con la del pedido.',
      );
      if (event.type === 'checkout.session.completed') {
        requireValue(
          session.payment_status === 'paid' &&
            session.amount_total === order.total_cents &&
            session.currency === order.currency &&
            session.client_reference_id === order.id,
          409,
          'El pago no corresponde al pedido.',
        );
        if (order.payment_status === 'paid') return;
        requireValue(
          order.status === 'awaiting_payment' && !order.inventory_released,
          409,
          'Es necesario conciliar el pago antes de confirmar el pedido.',
        );
        await db.query(
          "UPDATE orders SET payment_status='paid',status='confirmed',checkout_id=$2,payment_intent=$3,due_at=CASE WHEN kind='shop' THEN current_date+production_days ELSE due_at END,updated_at=now() WHERE id=$1",
          [id, session.id, session.payment_intent],
        );
        await addEvent(
          db,
          id,
          null,
          'Pago confirmado. El atelier preparará tu pedido.',
        );
        await notifier?.enqueue(db, order, 'paid');
      } else if (
        order.status === 'awaiting_payment' &&
        order.payment_status !== 'paid'
      ) {
        await releaseInventory(db, order);
        await db.query(
          "UPDATE orders SET status='cancelled',checkout_id=$2,updated_at=now() WHERE id=$1",
          [id, session.id],
        );
        await addEvent(
          db,
          id,
          null,
          'El plazo de pago ha terminado. Pedido cancelado.',
        );
      }
    });
  }
  async function cancel(id, user) {
    await transaction(pool, async (db) => {
      const order = await accessibleOrder(db, id, user, true);
      requireValue(
        ['requested', 'awaiting_payment', 'cancelled'].includes(order.status) &&
          order.payment_status !== 'paid',
        409,
        'Un pedido pagado requiere atención del atelier.',
      );
      if (order.status === 'cancelled') return;
      if (order.checkout_id) {
        requireValue(stripe, 503, 'No se puede comprobar el pago ahora.');
        let session = await stripe.checkout.sessions.retrieve(
          order.checkout_id,
        );
        if (session.status === 'open')
          session = await stripe.checkout.sessions.expire(session.id);
        requireValue(
          session.status === 'expired',
          409,
          'El pago ya se completó. Actualiza tus pedidos.',
        );
      } else {
        // Se uma criação de Checkout perdeu a resposta, não liberar estoque cedo.
        // pending é persistido antes da chamada externa (ver rota de checkout).
        requireValue(
          order.payment_status !== 'pending',
          409,
          'Estamos comprobando el pago. Contacta con el atelier.',
        );
      }
      await releaseInventory(db, order);
      await db.query(
        "UPDATE orders SET status='cancelled',updated_at=now() WHERE id=$1",
        [id],
      );
      await addEvent(db, id, user.id, 'Pedido cancelado.');
    });
  }
  // Recuperação explícita: o administrador copia o ID do Checkout no Stripe.
  // Consultamos o provedor; ninguém pode marcar um pedido como pago manualmente.
  async function reconcile(id, user, sessionId) {
    requireValue(stripe, 503, 'No se puede comprobar el pago ahora.');
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    await transaction(pool, async (db) => {
      const order = await accessibleOrder(db, id, user, true);
      requireValue(
        session.metadata?.order_id === id &&
          session.client_reference_id === id &&
          session.amount_total === order.total_cents &&
          session.currency === order.currency &&
          (!order.checkout_id || order.checkout_id === session.id),
        409,
        'La sesión de Stripe no corresponde a este pedido.',
      );
      await db.query(
        'UPDATE orders SET checkout_id=$2,checkout_url=$3 WHERE id=$1',
        [id, session.id, session.url],
      );
      await addEvent(
        db,
        id,
        user.id,
        'Pago consultado directamente en Stripe.',
      );
    });
    if (['complete', 'expired'].includes(session.status))
      await receive({
        id: `reconcile_${session.id}_${session.status}`,
        type:
          session.status === 'complete'
            ? 'checkout.session.completed'
            : 'checkout.session.expired',
        data: { object: session },
      });
  }
  return { checkout, receive, cancel, reconcile, stripe };
}
