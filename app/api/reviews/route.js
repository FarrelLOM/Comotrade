import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request) {
  const productSlug = new URL(request.url).searchParams.get('product');
  if (!productSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug)) {
    return NextResponse.json({ error: 'Produk ulasan tidak valid.' }, { status: 400 });
  }
  try {
    const { rows } = await query(
      `SELECT r.id, r.rating, r.body, r.created_at, u.full_name
       FROM reviews r
       JOIN order_items oi ON oi.id = r.order_item_id
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       JOIN users u ON u.id = r.user_id
       WHERE p.slug = ? AND o.status = 'delivered'
       ORDER BY r.created_at DESC LIMIT 50`,
      [productSlug],
    );
    return NextResponse.json({ reviews: rows });
  } catch (error) {
    console.error('Product review listing failed:', error?.message);
    return NextResponse.json({ error: 'Ulasan belum tersedia.' }, { status: 503 });
  }
}

export async function POST(request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const { orderItemId, rating, body } = await request.json();
    const score = Number(rating);
    const reviewText = String(body || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(String(orderItemId || '')) || !Number.isInteger(score) || score < 1 || score > 6 || reviewText.length > 3000) {
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
