import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPublicCallbackUrl, getPublicOrigin } from '@/lib/public-origin.mjs';
import { safeReturnTo } from '@/lib/safe-return-to.mjs';

export const runtime = 'nodejs';

const STATE_COOKIE = 'comotrade_google_state';
const RETURN_TO_COOKIE = 'comotrade_google_return_to';

function getRedirectUri(request) {
  return getPublicCallbackUrl({
    configuredUrl: process.env.GOOGLE_REDIRECT_URI,
    pathname: '/api/auth/google/callback',
    request,
  });
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const returnTo = safeReturnTo(requestUrl.searchParams.get('returnTo'));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    const loginUrl = new URL('/login', getPublicOrigin(request));
    loginUrl.searchParams.set('error', 'google_unconfigured');
    loginUrl.searchParams.set('returnTo', returnTo);
    return NextResponse.redirect(loginUrl);
  }

  let redirectUri;
  try {
    redirectUri = getRedirectUri(request);
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
    const loginUrl = new URL('/login', getPublicOrigin(request));
    loginUrl.searchParams.set('error', 'google_unconfigured');
    loginUrl.searchParams.set('returnTo', returnTo);
    return NextResponse.redirect(loginUrl);
  }
}
