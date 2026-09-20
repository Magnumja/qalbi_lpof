import { z } from 'zod';
export const uuid = z.uuid();
export const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(12).max(128),
});
// Sem inferir país: o telefone precisa incluir +DDI (ou 00DDI).
export const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .transform((v) => v.replace(/[\s().-]/g, '').replace(/^00/, '+'))
  .pipe(
    z
      .string()
      .regex(
        /^\+[1-9][0-9]{7,14}$/,
        'Incluye el prefijo del país, por ejemplo +34 600 123 456.',
      ),
  );
export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3)
    .max(254)
    .transform((v) =>
      v.includes('@')
        ? v.toLowerCase()
        : v.replace(/[\s().-]/g, '').replace(/^00/, '+'),
    ),
  password: z.string().min(12).max(128),
});
export const registration = credentials.extend({
  phone: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    phoneSchema.optional(),
  ),
  name: z.string().trim().min(2).max(100),
});
export const addressSchema = z.object({
  name: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(100),
  postal_code: z.string().trim().min(2).max(20),
  country: z.string().regex(/^[A-Z]{2}$/),
});
export const productSchema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().min(10).max(4000),
  category: z.string().trim().min(2).max(60),
  image_url: z
    .string()
    .max(1000)
    .refine(
      (v) => /^\/shop\/[a-zA-Z0-9_.-]+$/.test(v) || /^https:\/\//.test(v),
      'Usa una imagen HTTPS o /shop/archivo.jpg.',
    ),
  price_cents: z.number().int().min(100).max(1000000),
  kind: z.enum(['ready', 'made_to_order']),
  stock: z.number().int().min(0).max(10000),
  lead_days: z.number().int().min(1).max(365),
  active: z.boolean(),
});
export const orderSchema = z.object({
  request_key: uuid,
  address: addressSchema,
  brief: z.string().trim().max(4000).default(''),
  items: z
    .array(
      z.object({ product_id: uuid, quantity: z.number().int().min(1).max(20) }),
    )
    .min(1)
    .max(20),
});
export const customSchema = z.object({
  request_key: uuid,
  address: addressSchema,
  brief: z.string().trim().min(20).max(4000),
});
export const quoteSchema = z.object({
  total_cents: z.number().int().min(100).max(2000000),
  due_at: z.iso.date(),
});
export const progressSchema = z.object({
  status: z.enum(['confirmed', 'in_progress', 'ready', 'shipped', 'completed']),
  due_at: z.iso.date().nullable(),
  tracking: z.string().trim().max(300).default(''),
});
export const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
