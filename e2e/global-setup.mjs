// Roda uma vez por execução: se um teste falha, o Playwright recria o worker
// e um beforeAll voltaria a limpar o banco no meio da sequência.
import { resetDatabase, pool } from './helpers.mjs';
export default async function globalSetup() {
  await resetDatabase();
  await pool.end();
}
