import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const { orderItemId, rating, body } = await request.json();
    const score = Number(rating);
    const reviewText = String(body || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(String(orderItemId || '')) || !Number.isInteger(score) || score < 1 || score > 5 || reviewText.length > 3000) {
      return NextResponse.json({ error: 'Ulasan tidak valid.' }, { status: 400 });
    }
    const id = randomUUID();
    const { rowCount } = await query(
      `INSERT INTO reviews (id, order_item_id, user_id, rating, body)
       SELECT ?, oi.id, ?, ?, ? FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = ? AND o.user_id = ? AND o.status = 'delivered'`,
      [id, user.id, score, reviewText, orderItemId, user.id],
    );
    if (!rowCount) return NextResponse.json({ error: 'Ulasan hanya dapat dibuat untuk barang pada pesanan selesai.' }, { status: 409 });
    const { rows } = await query(
      `SELECT id, order_item_id, rating, body, created_at FROM reviews WHERE id = ?`,
      [id],
    );
    return NextResponse.json({ review: rows[0] }, { status: 201 });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Barang pada pesanan ini sudah diulas.' }, { status: 409 });
    console.error('Review creation failed:', error?.message);
    return NextResponse.json({ error: 'Ulasan belum dapat disimpan.' }, { status: 500 });
  }
}
