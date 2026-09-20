import { Buffer } from 'node:buffer';
import { z } from 'zod';
import sharp from 'sharp';
import { rateLimit } from './auth.mjs';
import { HttpError, requireValue } from './errors.mjs';
import { imageUrl } from './schemas.mjs';

const photo = z.object({
  src: imageUrl,
  alt: z.string().trim().min(3).max(300),
});
export const homeSchema = z.object({
  revision: z.number().int().positive(),
  content: z.object({
    photos: z.object({ hero: photo, story: photo, portrait: photo }),
    cards: z
      .array(
        photo.extend({
          id: z.string().regex(/^[a-z0-9-]{1,80}$/),
          title: z.string().trim().min(2).max(150),
          category: z
            .string()
            .trim()
            .min(2)
            .max(60)
            .refine((v) => v.toLowerCase() !== 'todas'),
          description: z.string().trim().min(10).max(4000),
          visible: z.boolean(),
        }),
      )
      .max(30)
      .refine(
        (cards) => new Set(cards.map((c) => c.id)).size === cards.length,
        'Los identificadores deben ser únicos.',
      ),
  }),
});
export function publicHomeRoutes(app, pool) {
  app.get('/api/home', async (_req, res) => {
    const { rows } = await pool.query(
      'SELECT revision,content FROM home_content WHERE id=true',
    );
    const home = rows[0];
    res.json({
      revision: home.revision,
      content: {
        ...home.content,
        cards: home.content.cards.filter((c) => c.visible),
      },
    });
  });
  app.get('/api/media/:id', async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const { rows } = await pool.query('SELECT data FROM media WHERE id=$1', [
      id,
    ]);
    requireValue(rows[0], 404, 'Foto no encontrada.');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type('image/webp').send(rows[0].data);
  });
}
// Montadas depois de authenticate + adminOnly, inclusive uploads.
export function adminHomeRoutes(app, pool) {
  app.get('/api/admin/home', async (_req, res) => {
    res.json(
      (
        await pool.query(
          'SELECT revision,content FROM home_content WHERE id=true',
        )
      ).rows[0],
    );
  });
  app.put('/api/admin/home', async (req, res) => {
    const input = homeSchema.parse(req.body);
    const { rows } = await pool.query(
      'UPDATE home_content SET content=$1,revision=revision+1,updated_at=now() WHERE id=true AND revision=$2 RETURNING revision,content',
      [input.content, input.revision],
    );
    requireValue(
      rows[0],
      409,
      'La página cambió en otra sesión. Recarga el editor antes de publicar.',
    );
    res.json(rows[0]);
  });
  app.post('/api/admin/media', async (req, res) => {
    await rateLimit(pool, `media:${req.user.id}`, 30, 3600);
    const { data } = z
      .object({
        data: z
          .string()
          .max(750000)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      })
      .parse(req.body);
    let bytes;
    try {
      const input = sharp(Buffer.from(data, 'base64'), {
        limitInputPixels: 16000000,
      });
      const metadata = await input.metadata();
      requireValue(
        ['jpeg', 'png', 'webp'].includes(metadata.format),
        400,
        'Usa JPG, PNG o WebP.',
      );
      // Reencoda o arquivo, remove metadados e limita o tamanho armazenado no Neon.
      bytes = await input
        .rotate()
        .resize({
          width: 1400,
          height: 1400,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      throw new HttpError(400, 'No se pudo leer la foto. Usa JPG, PNG o WebP.');
    }
    requireValue(
      bytes.length <= 500000,
      400,
      'La foto es demasiado grande. Elige una imagen más pequeña.',
    );
    const { rows } = await pool.query(
      'INSERT INTO media(data) VALUES($1) RETURNING id',
      [bytes],
    );
    res.status(201).json({ url: `/api/media/${rows[0].id}` });
  });
}
