import { Buffer } from 'node:buffer';
import {
  scrypt as scryptCallback,
  randomBytes,
  createHash,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from './errors.mjs';
const scrypt = promisify(scryptCallback);
export const tokenHash = (token) =>
  createHash('sha256').update(token).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const buffer = Buffer.from(expected, 'hex');
  return buffer.length === actual.length && timingSafeEqual(buffer, actual);
}
export function sessionToken(req) {
  const token = (req.headers.cookie || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('qalbi_session='))
    ?.split('=')[1];
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
// Rótulo curto do aparelho para a lista de sessões; sem fingerprint.
export function deviceLabel(req) {
  const ua = String(req.headers['user-agent'] ?? '');
  const os = /iPhone|iPad/.test(ua)
    ? 'iPhone/iPad'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS/.test(ua)
        ? 'Mac'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Dispositivo';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'navegador';
  return `${os} · ${browser}`;
}
export async function startSession(pool, res, userId, config, req) {
  const token = randomBytes(32).toString('hex');
  await pool.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at,label) VALUES($1,$2,now()+interval '7 days',$3)",
    [tokenHash(token), userId, req ? deviceLabel(req) : ''],
  );
  res.cookie('qalbi_session', token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 86400000,
  });
}
export function authenticate(pool) {
  return async (req, _res, next) => {
    const token = sessionToken(req);
    if (!token) throw new HttpError(401, 'Inicia sesión para continuar.');
    // Uso renova a sessão por 7 dias, até 30 dias desde o início.
    const { rows } = await pool.query(
      `UPDATE sessions s SET last_seen_at=now(),expires_at=LEAST(now()+interval '7 days',s.created_at+interval '30 days')
       FROM users u WHERE u.id=s.user_id AND s.token_hash=$1 AND s.expires_at>now()
       RETURNING u.id,u.name,u.email,u.phone,u.role,u.email_notifications`,
      [tokenHash(token)],
    );
    if (!rows[0])
      throw new HttpError(401, 'Tu sesión ha caducado. Vuelve a entrar.');
    req.user = rows[0];
    next();
  };
}
export function adminOnly(req, _res, next) {
  if (req.user.role !== 'admin')
    throw new HttpError(403, 'Acceso restringido al atelier.');
  next();
}
// PostgreSQL mantém o limite compartilhado entre instâncias do Render.
export async function rateLimit(pool, key, limit = 30, seconds = 900) {
  const { rows } = await pool.query(
    `INSERT INTO rate_limits(key,hits,expires_at) VALUES($1,1,now()+$2*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.hits+1 END,
    expires_at=CASE WHEN rate_limits.expires_at<now() THEN excluded.expires_at ELSE rate_limits.expires_at END RETURNING hits`,
    [tokenHash(key), seconds],
  );
  if (rows[0].hits > limit)
    throw new HttpError(429, 'Demasiados intentos. Espera unos minutos.');
}

// Senha exposta em vazamentos conhecidos (k-anonymity: só 5 caracteres do hash saem).
// Falha aberta: se o serviço não responder, o cadastro segue.
export async function pwnedPassword(password) {
  const digest = createHash('sha1')
    .update(password)
    .digest('hex')
    .toUpperCase();
  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`,
      {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'qalbi-atelier' },
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) return false;
    const suffix = digest.slice(5);
    return (await response.text())
      .split('\n')
      .some((line) => line.startsWith(suffix) && !line.trim().endsWith(':0'));
  } catch {
    return false;
  }
}
