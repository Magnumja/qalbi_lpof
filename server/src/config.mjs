import { z } from 'zod';

export function readConfig(env = process.env) {
  const schema = z.object({
    DATABASE_URL: z.string().min(1),
    FRONTEND_URL: z.url(),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().default(4000),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    SHIPPING_CENTS: z.coerce.number().int().min(0).max(100000).default(0),
    SHIPPING_COUNTRIES: z.string().default('ES'),
    RESEND_API_KEY: z.string().optional(),
    NOTIFY_FROM: z.string().optional(),
  });
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      'Configure DATABASE_URL e FRONTEND_URL no ambiente do backend.',
    );
  const config = result.data;
  if (config.NODE_ENV === 'production' && env.SHIPPING_CENTS === undefined)
    throw new Error(
      'Defina SHIPPING_CENTS explicitamente; use 0 apenas para envio grátis.',
    );
  if (!!config.STRIPE_SECRET_KEY !== !!config.STRIPE_WEBHOOK_SECRET)
    throw new Error('Configure as duas chaves Stripe: API e webhook.');
  if (!!config.RESEND_API_KEY !== !!config.NOTIFY_FROM)
    throw new Error('Configure RESEND_API_KEY e NOTIFY_FROM juntos.');
  config.FRONTEND_URL = new URL(config.FRONTEND_URL).origin;
  if (
    config.NODE_ENV === 'production' &&
    !config.FRONTEND_URL.startsWith('https://')
  ) {
    throw new Error('FRONTEND_URL precisa usar HTTPS em produção.');
  }
  if (
    config.NODE_ENV === 'production' &&
    !/[?&]sslmode=(require|verify-full|verify-ca)/.test(config.DATABASE_URL)
  ) {
    throw new Error('Use a conexão TLS fornecida pelo Neon.');
  }
  config.countries = config.SHIPPING_COUNTRIES.split(',').map((s) =>
    s.trim().toUpperCase(),
  );
  if (!config.countries.every((s) => /^[A-Z]{2}$/.test(s)))
    throw new Error('Países devem usar códigos ISO de duas letras.');
  return config;
}
