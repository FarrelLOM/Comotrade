import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const { rows } = await query(
      'SELECT id, full_name, email, password_hash, role FROM users WHERE email = $1',
      [normalizedEmail],
    );
    const account = rows[0];
    if (!account?.password_hash || !(await compare(String(password || ''), account.password_hash))) {
      return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 });
    }
    await createSession(account.id);
    return NextResponse.json({
      user: { id: account.id, full_name: account.full_name, email: account.email, role: account.role },
    });
  } catch (error) {
    console.error('Login failed:', error?.message);
    return NextResponse.json({ error: 'Login belum dapat diproses.' }, { status: 500 });
  }
}
