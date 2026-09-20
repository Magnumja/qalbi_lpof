// Avisos por email. Sem RESEND_API_KEY nada é enfileirado nem enviado.
// Mensagens são agrupadas: um aviso pendente por pessoa e pedido cobre as seguintes.
const subjects = {
  message: (n) => `Tienes un mensaje nuevo sobre tu pedido #${n}`,
  quote: (n) => `Tu presupuesto está listo · pedido #${n}`,
  paid: (n) => `Pago confirmado · pedido #${n}`,
  status: (n) => `Tu pedido #${n} avanza`,
};
const bodies = {
  message: 'Hay un mensaje nuevo en la conversación de tu pedido.',
  quote:
    'El atelier ya envió el presupuesto y el plazo. Entra para verlo y, si te encaja, pagar.',
  paid: 'Recibimos tu pago. El atelier empezará a preparar tu pedido.',
  status: 'El estado de tu pedido cambió. Entra para ver el detalle.',
};
export function createNotifier(pool, config, sender) {
  const enabled = !!(config.RESEND_API_KEY && config.NOTIFY_FROM);
  const send =
    sender ??
    (async ({ to, subject, text }) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: config.NOTIFY_FROM, to, subject, text }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`resend_${response.status}`);
    });
  // Quem recebe: o cliente do pedido ou todos os administradores.
  async function enqueue(db, order, kind, { toAdmins = false } = {}) {
    if (!enabled) return;
    const recipients = toAdmins
      ? "SELECT id FROM users WHERE role='admin'"
      : 'SELECT id FROM users WHERE id=$3 AND email_notifications';
    await db.query(
      `INSERT INTO notifications(user_id,order_id,kind)
       SELECT u.id,$1,$2 FROM (${recipients}) u
       WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id=u.id AND n.order_id=$1 AND n.kind=$2 AND n.sent_at IS NULL)`,
      toAdmins ? [order.id, kind] : [order.id, kind, order.user_id],
    );
  }
  async function deliverPending() {
    if (!enabled) return 0;
    const client = await pool.connect();
    let delivered = 0;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT n.id,n.kind,u.email,u.role,o.number,o.id AS order_id FROM notifications n
         JOIN users u ON u.id=n.user_id JOIN orders o ON o.id=n.order_id
         WHERE n.sent_at IS NULL AND n.attempts<5
           AND (n.kind<>'message' OR n.created_at<now()-interval '2 minutes')
         ORDER BY n.created_at LIMIT 20 FOR UPDATE OF n SKIP LOCKED`,
      );
      for (const n of rows) {
        const path = n.role === 'admin' ? '/admin' : '/cuenta';
        const link = `${config.FRONTEND_URL}${path}?order=${n.order_id}`;
        const text =
          n.role === 'admin'
            ? `Un cliente escribió en el pedido #${n.number}.\n\n${link}\n\nQalbi Atelier`
            : `${bodies[n.kind]}\n\n${link}\n\nPuedes desactivar estos avisos en Mi cuenta.\nQalbi Atelier`;
        try {
          await send({
            to: n.email,
            subject: subjects[n.kind](n.number),
            text,
          });
          await client.query(
            'UPDATE notifications SET sent_at=now(),attempts=attempts+1,error=NULL WHERE id=$1',
            [n.id],
          );
          delivered++;
        } catch (error) {
          await client.query(
            'UPDATE notifications SET attempts=attempts+1,error=$2 WHERE id=$1',
            [n.id, String(error.message ?? error).slice(0, 200)],
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return delivered;
  }
  return { enabled, enqueue, deliverPending };
}
