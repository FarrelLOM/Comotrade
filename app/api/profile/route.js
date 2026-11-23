import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const [{ rows: balanceRows }, { rows: transactions }] = await Promise.all([
      query('SELECT COALESCE(SUM(amount), 0) AS balance FROM wallet_transactions WHERE user_id = ?', [user.id]),
      query('SELECT id, amount, transaction_type, reference_key, description, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [user.id]),
    ]);
    return NextResponse.json({
      user: { id: user.id, username: user.username, full_name: user.full_name, phone: user.phone, email: user.email, role: user.role },
      wallet: { balance: Number(balanceRows[0]?.balance || 0), transactions },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Profile lookup failed:', error?.message);
    return NextResponse.json({ error: 'Informasi profil belum tersedia. Pastikan migrasi akun telah dijalankan.' }, { status: 503 });
  }
}

export async function PATCH(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const input = await request.json();
    const fullName = String(input.fullName || '').trim();
    const phone = String(input.phone || '').trim();
    if (fullName.length < 2 || fullName.length > 120 || (phone && !/^\+?[0-9 ()-]{7,30}$/.test(phone))) {
      return NextResponse.json({ error: 'Nama atau nomor HP tidak valid.' }, { status: 400 });
    }
    await query('UPDATE users SET full_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [fullName, phone || null, user.id]);
    return NextResponse.json({ user: { ...user, full_name: fullName, phone: phone || null } });
  } catch (error) {
    console.error('Profile update failed:', error?.message);
    return NextResponse.json({ error: 'Profil belum dapat diperbarui.' }, { status: 500 });
  }
}
