import { createHmac, timingSafeEqual } from 'node:crypto';
import process from 'node:process';

const COOKIE_NAME = 'tkj_admin_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function getSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim() || '';
  return Buffer.byteLength(secret, 'utf8') >= 32 ? secret : null;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function verifyAdminPassword(value: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !value) return false;
  const providedBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export function createAdminSessionCookie(): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  const token = `${payload}.${sign(payload, secret)}`;
  const secure = import.meta.env.PROD ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function clearAdminSessionCookie(): string {
  const secure = import.meta.env.PROD ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function isAdminRequest(request: Request): boolean {
  const secret = getSecret();
  if (!secret) return false;
  const cookies = request.headers.get('cookie') || '';
  const token = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return false;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;
  const payload = token.slice(0, separator);
  const provided = token.slice(separator + 1);
  const expected = sign(payload, secret);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}

export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Sesi admin tidak valid atau sudah berakhir.' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
