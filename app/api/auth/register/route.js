import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { fullName, email, password } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (String(fullName || '').trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Nama atau email tidak valid.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 10 || password.length > 72) {
      return NextResponse.json({ error: 'Password harus 10–72 karakter.' }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);
    const { rows } = await query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, full_name, email, role`,
      [String(fullName).trim().slice(0, 120), normalizedEmail, passwordHash],
    );
    await createSession(rows[0].id);
    return NextResponse.json({ user: rows[0] }, { status: 201 });
  } catch (error) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Email sudah terdaftar.' }, { status: 409 });
    }
    console.error('Registration failed:', error?.message);
    return NextResponse.json({ error: 'Registrasi belum dapat diproses.' }, { status: 500 });
  }
}
