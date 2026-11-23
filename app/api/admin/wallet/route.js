import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withTransaction } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  try {
    const input = await request.json();
    const userId = String(input.userId || '');
    const amount = Number(input.amount);
    const direction = String(input.direction || '');
    const description = String(input.description || '').trim().slice(0, 300);
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !Number.isSafeInteger(amount) || amount <= 0 || !['credit','debit'].includes(direction) || description.length < 3) {
      return NextResponse.json({ error: 'Pelanggan, nominal Rupiah, arah, atau alasan penyesuaian tidak valid.' }, { status: 400 });
    }
    const result = await withTransaction(async (tx) => {
      const { rows: users } = await tx.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
      if (!users[0]) return { missing: true };
      const { rows: balances } = await tx.query('SELECT COALESCE(SUM(amount),0) AS balance FROM wallet_transactions WHERE user_id = ?', [userId]);
      const balance = Number(balances[0]?.balance || 0);
      if (direction === 'debit' && balance < amount) return { insufficient: true, balance };
      const signedAmount = direction === 'credit' ? amount : -amount;
      await tx.query(
        `INSERT INTO wallet_transactions (id,user_id,amount,transaction_type,reference_key,description,created_by)
         VALUES (?,?,?,?,?,?,?)`,
        [randomUUID(),userId,signedAmount,direction,`ADMIN-${randomUUID()}`,description,admin.id],
      );
      return { balance: balance + signedAmount };
    });
    if (result.missing) return NextResponse.json({ error: 'Pelanggan tidak ditemukan.' }, { status: 404 });
    if (result.insufficient) return NextResponse.json({ error: `Saldo wallet tidak cukup. Saldo saat ini ${result.balance} IDR.` }, { status: 409 });
    return NextResponse.json({ wallet: result });
  } catch (error) {
    console.error('Admin wallet adjustment failed:', error?.message);
    return NextResponse.json({ error: 'Penyesuaian wallet belum dapat disimpan.' }, { status: 500 });
  }
}
