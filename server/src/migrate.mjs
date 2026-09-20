import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createPool, transaction } from './db.mjs';

export async function migrate(pool) {
  await transaction(pool, async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(7146201)');
    await db.query(
      'CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const directory = new URL('../migrations/', import.meta.url);
    for (const name of (await readdir(directory))
      .filter((s) => s.endsWith('.sql'))
      .sort()) {
      if (
        (await db.query('SELECT 1 FROM migrations WHERE name=$1', [name]))
          .rowCount
      )
        continue;
      await db.query(await readFile(new URL(name, directory), 'utf8'));
      await db.query('INSERT INTO migrations(name) VALUES($1)', [name]);
    }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida.');
  const pool = createPool(process.env.DATABASE_URL);
  try {
    await migrate(pool);
    console.log('Migrações aplicadas.');
  } finally {
    await pool.end();
  }
}
