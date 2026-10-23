import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
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
    return NextResponse.json({
      user: { id: account.id, full_name: account.full_name, username: account.username, email: account.email, role: account.role },
    });
  } catch (error) {
    console.error('Login failed:', error?.message);
    return NextResponse.json({ error: 'Login belum dapat diproses.' }, { status: 500 });
  }
}
