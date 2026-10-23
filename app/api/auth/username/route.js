import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request) {
  const username = new URL(request.url).searchParams.get('value')?.trim().toLowerCase() || '';
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    return NextResponse.json({ error: 'Format username tidak valid.' }, { status: 400 });
  }
  try {
    const { rows } = await query('SELECT 1 FROM users WHERE username = ? LIMIT 1', [username]);
    return NextResponse.json({ available: rows.length === 0 });
  } catch (error) {
    console.error('Username availability check failed:', error?.message);
    return NextResponse.json({ error: 'Ketersediaan username belum dapat diperiksa.' }, { status: 503 });
  }
}
