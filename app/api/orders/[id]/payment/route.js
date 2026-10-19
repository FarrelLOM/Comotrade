import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  const { id } = await params;
  try {
    const { reference } = await request.json();
    const safeReference = String(reference || '').trim();
    if (safeReference.length < 3 || safeReference.length > 200) {
      return NextResponse.json({ error: 'Referensi pembayaran tidak valid.' }, { status: 400 });
    }
    const { rows } = await query(
      `UPDATE payments p SET status='submitted', provider_reference=$1, updated_at=now()
       FROM orders o WHERE p.order_id=o.id AND o.id=$2 AND o.user_id=$3 AND p.status IN ('pending','failed')
       RETURNING p.order_id,p.status,p.provider_reference`,
      [safeReference, id, user.id],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Pembayaran pesanan tidak ditemukan atau sudah diproses.' }, { status: 404 });
    await query("UPDATE orders SET status='payment_review',updated_at=now() WHERE id=$1 AND status='pending_payment'", [id]);
    return NextResponse.json({ payment: rows[0] }, { status: 202 });
  } catch (error) {
    console.error('Payment submission failed:', error?.message);
    return NextResponse.json({ error: 'Informasi pembayaran belum dapat disimpan.' }, { status: 500 });
  }
}
