import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const returnTo = safeReturnTo(requestUrl.searchParams.get('returnTo'));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'google_unconfigured');
    loginUrl.searchParams.set('returnTo', returnTo);
    return NextResponse.redirect(loginUrl);
  }

  let redirectUri;
  try {
    redirectUri = getRedirectUri();
    const state = randomBytes(32).toString('base64url');
    const store = await cookies();
    store.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/google/callback',
      maxAge: 600,
    });
    store.set(RETURN_TO_COOKIE, returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/google/callback',
      maxAge: 600,
    });
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString();
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error('Google OAuth initialization failed:', error?.message);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'google_unconfigured');
    loginUrl.searchParams.set('returnTo', returnTo);
    return NextResponse.redirect(loginUrl);
  }
}
