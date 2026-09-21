// Avisos por email. Sem RESEND_API_KEY nada é enfileirado nem enviado.
// Mensagens são agrupadas: um aviso pendente por pessoa e pedido cobre as seguintes.
const subjects = {
  message: (n) => `Tienes un mensaje nuevo sobre tu pedido #${n}`,
  quote: (n) => `Tu presupuesto está listo · pedido #${n}`,
  paid: (n) => `Pago confirmado · pedido #${n}`,
  status: (n) => `Tu pedido #${n} avanza`,
  login: () => 'Nuevo acceso a tu cuenta de Qalbi',
};
const bodies = {
  message: 'Hay un mensaje nuevo en la conversación de tu pedido.',
  quote:
    'El atelier ya envió el presupuesto y el plazo. Entra para verlo y, si te encaja, pagar.',
  paid: 'Recibimos tu pago. El atelier empezará a preparar tu pedido.',
  status: 'El estado de tu pedido cambió. Entra para ver el detalle.',
  login:
    'Alguien acaba de entrar en tu cuenta. Si fuiste tú, no tienes que hacer nada. Si no, cambia la contraseña desde Mi cuenta o pide un enlace de acceso al atelier.',
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
       WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id=u.id AND n.order_id IS NOT DISTINCT FROM $1 AND n.kind=$2 AND n.sent_at IS NULL)`,
      toAdmins ? [order.id, kind] : [order.id, kind, order.user_id],
    );
  }
  // Aviso sem pedido: novo acesso à conta.
  async function enqueueForUser(db, userId, kind) {
    if (!enabled) return;
    await db.query(
      `INSERT INTO notifications(user_id,kind) SELECT id,$2 FROM users WHERE id=$1 AND email_notifications`,
      [userId, kind],
    );
  }
  async function deliverPending() {
    if (!enabled) return 0;
    // Reserva as linhas e encerra a transação antes de falar com o provedor.
    const { rows } = await pool.query(
      `UPDATE notifications n SET claimed_at=now(),attempts=attempts+1
       FROM (SELECT id FROM notifications WHERE sent_at IS NULL AND attempts<5
               AND (claimed_at IS NULL OR claimed_at<now()-interval '5 minutes')
               AND (kind<>'message' OR created_at<now()-interval '2 minutes')
             ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED) due
       WHERE n.id=due.id RETURNING n.id,n.kind,n.user_id,n.order_id`,
    );
    let delivered = 0;
    for (const n of rows) {
      const { rows: people } = await pool.query(
        'SELECT u.email,u.role,o.number FROM users u LEFT JOIN orders o ON o.id=$2 WHERE u.id=$1',
        [n.user_id, n.order_id],
      );
      const person = people[0];
      if (!person) continue;
      const path = person.role === 'admin' ? '/admin' : '/cuenta';
      const link = n.order_id
        ? `${config.FRONTEND_URL}${path}?order=${n.order_id}`
        : `${config.FRONTEND_URL}${path}`;
      const text =
        person.role === 'admin'
          ? `Un cliente escribió en el pedido #${person.number}.\n\n${link}\n\nQalbi Atelier`
          : `${bodies[n.kind]}\n\n${link}\n\nPuedes desactivar estos avisos en Mi cuenta.\nQalbi Atelier`;
      try {
        await send({
          to: person.email,
          subject: subjects[n.kind](person.number),
          text,
        });
        await pool.query(
          'UPDATE notifications SET sent_at=now(),error=NULL WHERE id=$1',
          [n.id],
        );
        delivered++;
      } catch (error) {
        await pool.query('UPDATE notifications SET error=$2 WHERE id=$1', [
          n.id,
          String(error.message ?? error).slice(0, 200),
        ]);
      }
    }
    return delivered;
  }
  return { enabled, enqueue, enqueueForUser, deliverPending };
}
