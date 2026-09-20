import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createPool, transaction } from './db.mjs';
import { HttpError } from './errors.mjs';

/**
 * Atende um pedido de exclusão de conta. Pedidos ficam para fins fiscais,
 * mas sem dados pessoais: nome, contato, endereço, ideia e mensagens do
 * cliente são anonimizados; fotos, sessões, links e avisos são apagados.
 */
export async function forgetCustomer(pool, email) {
  return transaction(pool, async (db) => {
    const user = (
      await db.query(
        "SELECT id FROM users WHERE email=$1 AND role='customer' FOR UPDATE",
        [email.toLowerCase().trim()],
      )
    ).rows[0];
    if (!user) throw new HttpError(404, 'Cliente não encontrado.');
    const open = (
      await db.query(
        "SELECT count(*)::int AS n FROM orders WHERE user_id=$1 AND payment_status='paid' AND status NOT IN ('completed','cancelled')",
        [user.id],
      )
    ).rows[0].n;
    if (open)
      throw new HttpError(
        409,
        `Há ${open} pedido(s) pago(s) em andamento. Conclua ou cancele antes de anonimizar.`,
      );
    await db.query('DELETE FROM sessions WHERE user_id=$1', [user.id]);
    await db.query('DELETE FROM access_links WHERE user_id=$1', [user.id]);
    await db.query('DELETE FROM notifications WHERE user_id=$1', [user.id]);
    await db.query('DELETE FROM order_reads WHERE user_id=$1', [user.id]);
    await db.query(
      'UPDATE messages SET media_id=NULL WHERE media_id IN (SELECT id FROM media WHERE owner_id=$1)',
      [user.id],
    );
    await db.query('DELETE FROM media WHERE owner_id=$1', [user.id]);
    await db.query(
      "UPDATE messages SET body='[mensaje eliminado a petición del cliente]' WHERE sender_id=$1",
      [user.id],
    );
    await db.query(
      `UPDATE orders SET brief='',tracking='',address=jsonb_build_object('name','—','line1','—','city','—','postal_code','—','country',address->>'country'),updated_at=now() WHERE user_id=$1`,
      [user.id],
    );
    const { rows } = await db.query(
      `UPDATE users SET name='Cliente eliminado',email=$2,phone=NULL,password_hash=$3,email_notifications=false WHERE id=$1 RETURNING id`,
      [
        user.id,
        `eliminado+${user.id}@invalid.qalbi`,
        `x:${randomBytes(32).toString('hex')}`,
      ],
    );
    return rows[0].id;
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = await rl.question('Email do cliente a anonimizar: ');
  const confirm = await rl.question(
    'Isto é irreversível. Digite o email novamente para confirmar: ',
  );
  rl.close();
  if (email.trim() !== confirm.trim()) throw new Error('Emails não conferem.');
  const pool = createPool(process.env.DATABASE_URL);
  try {
    await forgetCustomer(pool, email);
    console.log('Conta anonimizada. Pedidos preservados sem dados pessoais.');
  } finally {
    await pool.end();
  }
}
