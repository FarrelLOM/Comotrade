import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { query } from './db';

const COOKIE_NAME = 'comotrade_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;

async function secureCookie() {
  const requestHeaders = await headers();
  const forwardedProtocol = requestHeaders.get('x-forwarded-proto')?.toLowerCase();
  const host = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '').toLowerCase();
  const protocol = forwardedProtocol || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : '');
  if (protocol === 'http') return false;
  if (protocol === 'https') return true;
  return /^https:\/\//i.test(process.env.APP_URL || '');
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be configured with at least 32 characters.');
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000);
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: await secureCookie(),
    sameSite: 'lax',
    path: '/',
    expires,
    maxAge: SESSION_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: await secureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== 'string') return null;
    const { rows } = await query(
      'SELECT id, username, full_name, phone, email, role FROM users WHERE id = ?',
      [payload.sub],
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function requireUser() {
  return getCurrentUser();
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === 'admin' ? user : null;
}
