import { seedAdmin } from './seed-admin.mjs';
import { readConfig } from './config.mjs';
import { createPool } from './db.mjs';
import { createApp } from './app.mjs';
import { expireUnstartedOrders, pruneExpiredRecords } from './maintenance.mjs';
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
      .then(() => pruneExpiredRecords(pool))
      .catch(() => console.error('Falha na limpeza de registros vencidos.')),
  3600000,
);
cleanup.unref();
const notifications = setInterval(
  () =>
    app.locals.notifier
      .deliverPending()
      .catch(() => console.error('Falha no envio de avisos.')),
  60000,
);
notifications.unref();
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
    clearInterval(notifications);
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  });
