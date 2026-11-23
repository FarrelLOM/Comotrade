import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { getPublicOrigin } from '@/lib/public-origin.mjs';
import { safeReturnTo } from '@/lib/safe-return-to.mjs';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const appOrigin = getPublicOrigin(request);
    const { username, password, returnTo } = await request.json();
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const { rows } = await query(
      'SELECT id, full_name, username, email, password_hash, role FROM users WHERE username = ?',
      [normalizedUsername],
    );
    const account = rows[0];
    if (!account?.password_hash || !(await compare(String(password || ''), account.password_hash))) {
      return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
    }
    await createSession(account.id);
    const destination = account.role === 'admin' ? '/admin' : safeReturnTo(returnTo);
    return NextResponse.json({
      user: { id: account.id, full_name: account.full_name, username: account.username, email: account.email, role: account.role },
      redirectUrl: new URL(destination, appOrigin).toString(),
    });
  } catch (error) {
    console.error('Login failed:', error?.message);
    return NextResponse.json({ error: 'Login belum dapat diproses.' }, { status: 500 });
  }
}
