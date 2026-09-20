import { seedAdmin } from './seed-admin.mjs';
import { readConfig } from './config.mjs';
import { createPool } from './db.mjs';
import { createApp } from './app.mjs';
import { expireUnstartedOrders } from './maintenance.mjs';
const config = readConfig();
const pool = createPool(config.DATABASE_URL);
pool.on('error', () => console.error('Conexão PostgreSQL interrompida.'));
await seedAdmin(pool);
const app = createApp(pool, config);
const server = app.listen(config.PORT, '0.0.0.0', () =>
  console.log(`Qalbi API pronta na porta ${config.PORT}`),
);
// Apenas registros operacionais expirados são apagados. Pedidos e mensagens são preservados.
const cleanup = setInterval(
  () =>
    pool
      .query(
        'DELETE FROM sessions WHERE expires_at<now(); DELETE FROM rate_limits WHERE expires_at<now()',
      )
      .catch(() => console.error('Falha na limpeza de sessões.')),
  3600000,
);
cleanup.unref();
const reservations = setInterval(
  () =>
    expireUnstartedOrders(pool).catch(() =>
      console.error('Falha na revisão de reservas.'),
    ),
  60000,
);
reservations.unref();
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    clearInterval(cleanup);
    clearInterval(reservations);
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  });
