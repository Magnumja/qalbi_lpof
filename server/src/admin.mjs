import { createInterface } from 'node:readline/promises';
import { createPool, transaction } from './db.mjs';
import { hashPassword } from './auth.mjs';
import { registration } from './schemas.mjs';
const rl = createInterface({ input: process.stdin, output: process.stdout });
const email =
  process.env.ADMIN_EMAIL ?? (await rl.question('Email do administrador: '));
const name = process.env.ADMIN_NAME ?? (await rl.question('Nome: '));
// Senha fornecida por ambiente; não colocar no comando ou no histórico do terminal.
const password = process.env.ADMIN_PASSWORD;
rl.close();
if (!password)
  throw new Error(
    'Defina ADMIN_PASSWORD no ambiente temporariamente (mínimo 12 caracteres).',
  );
const input = registration.parse({ email, name, password });
const pool = createPool(process.env.DATABASE_URL);
try {
  const hash = await hashPassword(input.password);
  await transaction(pool, async (db) => {
    const user = (
      await db.query(
        "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin') ON CONFLICT(email) DO UPDATE SET name=$1,password_hash=$3,role='admin' RETURNING id",
        [input.name, input.email, hash],
      )
    ).rows[0];
    await db.query('DELETE FROM sessions WHERE user_id=$1', [user.id]);
  });
  console.log('Administrador configurado. Sessões anteriores revogadas.');
} finally {
  await pool.end();
}
