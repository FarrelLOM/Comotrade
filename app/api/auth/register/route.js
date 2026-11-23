import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { getPublicOrigin } from '@/lib/public-origin.mjs';
import { safeReturnTo } from '@/lib/safe-return-to.mjs';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const appOrigin = getPublicOrigin(request);
    const { fullName, username, phone, email, password, returnTo } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const normalizedPhone = String(phone || '').trim();
    if (String(fullName || '').trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Nama atau email tidak valid.' }, { status: 400 });
    }
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizedUsername)) {
      return NextResponse.json({ error: 'Username harus 3–32 karakter dan diawali huruf atau angka.' }, { status: 400 });
    }
    if (normalizedPhone && !/^\+?[0-9 ()-]{7,30}$/.test(normalizedPhone)) {
      return NextResponse.json({ error: 'Nomor HP tidak valid.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 10 || password.length > 72) {
      return NextResponse.json({ error: 'Password harus 10–72 karakter.' }, { status: 400 });
    }

    const id = randomUUID();
    const passwordHash = await hash(password, 12);
    await query(
      `INSERT INTO users (id, username, full_name, phone, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, 'user')`,
      [id, normalizedUsername, String(fullName).trim().slice(0, 120), normalizedPhone || null, normalizedEmail, passwordHash],
    );
    const { rows } = await query(
      'SELECT id, full_name, username, email, role FROM users WHERE id = ?',
      [id],
    );
    await createSession(id);
    return NextResponse.json({
      user: rows[0],
      redirectUrl: new URL(safeReturnTo(returnTo), appOrigin).toString(),
    }, { status: 201 });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Username atau email sudah terdaftar.' }, { status: 409 });
    }
    console.error('Registration failed:', error?.message);
    return NextResponse.json({ error: 'Registrasi belum dapat diproses.' }, { status: 500 });
  }
}
