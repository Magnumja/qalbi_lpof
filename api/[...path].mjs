// Proxy de mesma origem: cookies ficam no domínio Vercel, não em cookies de terceiros.
// BACKEND_URL é privado e configurado no painel Vercel.
import { Buffer } from 'node:buffer';
export default async function handler(req, res) {
  const backend = process.env.BACKEND_URL;
  if (!backend || !backend.startsWith('https://'))
    return res
      .status(503)
      .json({ error: 'La tienda está en preparación. Vuelve pronto.' });
  const incoming = new URL(req.url, 'https://qalbi.invalid');
  if (!incoming.pathname.startsWith('/api/')) return res.status(404).end();
  const headers = { accept: 'application/json' };
  for (const name of ['cookie', 'content-type', 'origin', 'x-qalbi-request'])
    if (req.headers[name]) headers[name] = req.headers[name];
  // IP do visitante para os limites por IP; a API só confia com o segredo.
  const ip = String(
    req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? '',
  )
    .split(',')[0]
    .trim();
  if (process.env.PROXY_SECRET && ip) {
    headers['x-qalbi-proxy'] = process.env.PROXY_SECRET;
    headers['x-qalbi-client-ip'] = ip;
  }
  try {
    const response = await fetch(
      new URL(incoming.pathname + incoming.search, backend),
      {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method)
          ? undefined
          : JSON.stringify(req.body ?? {}),
        signal: AbortSignal.timeout(25000),
        redirect: 'manual',
      },
    );
    res.setHeader('Cache-Control', 'no-store');
    const isImage = incoming.pathname.startsWith('/api/media/') && response.ok;
    res.setHeader('Content-Type', isImage ? 'image/webp' : 'application/json');
    if (isImage)
      res.setHeader(
        'Cache-Control',
        response.headers.get('cache-control') ?? 'no-store',
      );
    const requestId = response.headers.get('x-request-id');
    if (requestId) res.setHeader('X-Request-Id', requestId);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    res
      .status(response.status)
      .send(
        isImage
          ? Buffer.from(await response.arrayBuffer())
          : await response.text(),
      );
  } catch {
    res.status(502).json({
      error: 'No se pudo conectar con el atelier. Inténtalo de nuevo.',
    });
  }
}
