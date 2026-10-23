import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';

export const runtime = 'nodejs';

const STATE_COOKIE = 'comotrade_google_state';
const RETURN_TO_COOKIE = 'comotrade_google_return_to';

function safeReturnTo(value) {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\') &&
    !value.includes('\\')
    ? value
    : '/#katalog-toko';
}

function getRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error('APP_URL or GOOGLE_REDIRECT_URI must be configured.');
  return new URL('/api/auth/google/callback', appUrl).toString();
}

function loginRedirect(request, reason, returnTo) {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', reason);
  url.searchParams.set('returnTo', safeReturnTo(returnTo));
  return NextResponse.redirect(url);
}

export async function GET(request) {
  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  const returnTo = safeReturnTo(store.get(RETURN_TO_COOKIE)?.value);
  store.delete(STATE_COOKIE);
  store.delete(RETURN_TO_COOKIE);
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!expectedState || !state || expectedState.length !== state.length ||
      !timingSafeEqual(Buffer.from(expectedState), Buffer.from(state))) {
    return loginRedirect(request, 'google_state', returnTo);
  }
  if (!code || url.searchParams.has('error')) return loginRedirect(request, 'google_denied', returnTo);

  try {
    const redirectUri = getRedirectUri();
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenData.access_token !== 'string') {
      throw new Error('Google token exchange failed.');
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: 'no-store',
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || typeof profile.sub !== 'string' ||
        typeof profile.email !== 'string' || profile.email_verified !== true) {
      throw new Error('Google did not return a verified account profile.');
    }

    const email = profile.email.trim().toLowerCase();
    const id = await withTransaction(async (client) => {
      const { rows: googleUsers } = await client.query(
        'SELECT id FROM users WHERE google_sub = ? FOR UPDATE',
        [profile.sub],
      );
      if (googleUsers[0]) return googleUsers[0].id;

      const { rows: existingUsers } = await client.query(
        'SELECT id, google_sub FROM users WHERE email = ? FOR UPDATE',
        [email],
      );
      if (existingUsers[0]) {
        if (existingUsers[0].google_sub) {
          throw new Error('This email is linked to a different Google account.');
        }
        await client.query(
          'UPDATE users SET google_sub = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [profile.sub, existingUsers[0].id],
        );
        return existingUsers[0].id;
      }

      const newUserId = randomUUID();
      const emailUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 22) || 'user';
      const username = `${emailUsername}_${newUserId.replaceAll('-', '').slice(0, 8)}`;
      await client.query(
        `INSERT INTO users (id, username, full_name, email, google_sub, role)
         VALUES (?, ?, ?, ?, ?, 'user')`,
        [newUserId, username, String(profile.name || profile.given_name || 'Pengguna Google').trim().slice(0, 120), email, profile.sub],
      );
      return newUserId;
    });
    await createSession(id);
    return NextResponse.redirect(new URL(returnTo, request.url));
  } catch (error) {
    console.error('Google OAuth callback failed:', error?.message);
    return loginRedirect(request, 'google_failed', returnTo);
  }
}
