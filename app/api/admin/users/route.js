import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  try {
    const term = String(new URL(request.url).searchParams.get('q') || '').trim().slice(0, 100);
    const like = `%${term}%`;
    const { rows } = await query(
      `SELECT u.id,u.username,u.full_name,u.email,u.phone,u.role,
       COALESCE(w.balance,0) AS wallet_balance
       FROM users u
       LEFT JOIN (SELECT user_id,SUM(amount) AS balance FROM wallet_transactions GROUP BY user_id) w ON w.user_id=u.id
       WHERE (? = '' OR u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)
       ORDER BY u.created_at DESC LIMIT 100`,
      [term,like,like,like],
    );
    return NextResponse.json({ users: rows });
  } catch (error) {
    console.error('Admin user listing failed:', error?.message);
    return NextResponse.json({ error: 'Daftar pelanggan belum tersedia.' }, { status: 503 });
  }
}
