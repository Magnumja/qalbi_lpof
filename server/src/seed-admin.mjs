import { registration } from './schemas.mjs';
import { hashPassword } from './auth.mjs';
import { transaction } from './db.mjs';

/** Seed de primeiro acesso. Reiniciar o serviço não redefine senhas existentes. */
export async function seedAdmin(pool, env = process.env) {
  if (!env.ADMIN_EMAIL && !env.ADMIN_PASSWORD) return false;
  const parsed = registration.safeParse({
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    name: env.ADMIN_NAME || 'Qalbi Atelier',
  });
  if (!parsed.success)
    throw new Error(
      'Configure ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres); ADMIN_NAME é opcional.',
    );
  const input = parsed.data;
  return transaction(pool, async (db) => {
    // Serializa o bootstrap se duas instâncias do Render iniciarem juntas.
    await db.query('SELECT pg_advisory_xact_lock(7146202)');
    const existing = (
      await db.query('SELECT role FROM users WHERE email=$1', [input.email])
    ).rows[0];
    if (existing) {
      if (existing.role !== 'admin')
        throw new Error(
          'ADMIN_EMAIL já pertence a um cliente. Use um email administrativo exclusivo.',
        );
      return false;
    }
    await db.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin')",
      [input.name, input.email, await hashPassword(input.password)],
    );
    return true;
  });
}
