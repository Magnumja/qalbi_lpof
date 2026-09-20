// Jornadas reais no navegador: API contra qalbi_test + build estático em preview.
// Exige TEST_DATABASE_URL (veja `npm run db:test`). Não usa contas nem Stripe reais.
import { defineConfig } from '@playwright/test';
const database = process.env.TEST_DATABASE_URL;
if (!database || new URL(database).pathname !== '/qalbi_test')
  throw new Error(
    'Defina TEST_DATABASE_URL apontando para o banco qalbi_test.',
  );
const frontend = 'http://127.0.0.1:4329';
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.mjs',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  outputDir: 'output/e2e',
  use: {
    baseURL: frontend,
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node server/src/migrate.mjs && node server/src/index.mjs',
      url: 'http://127.0.0.1:4009/health',
      env: {
        DATABASE_URL: database,
        FRONTEND_URL: frontend,
        NODE_ENV: 'test',
        PORT: '4009',
        SHIPPING_CENTS: '500',
        SHIPPING_COUNTRIES: 'ES',
        STRIPE_SECRET_KEY: '',
        STRIPE_WEBHOOK_SECRET: '',
      },
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'npx astro build && node scripts/serve-dist.mjs 4329 4009',
      url: frontend,
      reuseExistingServer: false,
      timeout: 180000,
    },
  ],
});
