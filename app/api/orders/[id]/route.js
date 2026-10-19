import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';

export const runtime = 'nodejs';
const statuses = new Set(['payment_review', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']);

export async function GET(_request, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  const { id } = await params;
  try {
    const { rows } = await query(
      `SELECT o.*, COALESCE(json_agg(json_build_object('id',oi.id,'product_id',oi.product_id,'name',oi.product_name,'unit_price',oi.unit_price,'quantity',oi.quantity,'line_total',oi.line_total)) FILTER (WHERE oi.id IS NOT NULL),'[]') AS items,
       json_build_object('carrier',s.carrier,'tracking_number',s.tracking_number,'tracking_url',s.tracking_url) AS shipment,
       p.status AS payment_status, p.provider AS payment_provider
       FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
       LEFT JOIN shipments s ON s.order_id=o.id LEFT JOIN payments p ON p.order_id=o.id
       WHERE o.id=$1 AND ($2::boolean OR o.user_id=$3)
       GROUP BY o.id,s.id,p.id`,
      [id, user.role === 'admin', user.id],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ order: rows[0] });
  } catch (error) {
    console.error('Order lookup failed:', error?.message);
    return NextResponse.json({ error: 'Detail pesanan belum tersedia.' }, { status: 503 });
  }
}

export async function PATCH(request, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const { id } = await params;
  try {
    const input = await request.json();
    const status = String(input.status || '');
    if (!statuses.has(status)) return NextResponse.json({ error: 'Status tidak diizinkan.' }, { status: 400 });
    const trackingUrl = String(input.trackingUrl || '').trim();
    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      return NextResponse.json({ error: 'URL tracking harus menggunakan HTTP(S).' }, { status: 400 });
    }
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT id,status FROM orders WHERE id=$1 FOR UPDATE', [id]);
      const current = rows[0];
      if (!current) return null;
      if (status === 'cancelled' && !['cancelled', 'shipped', 'delivered', 'refunded'].includes(current.status)) {
        const { rows: items } = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id=$1 AND product_id IS NOT NULL', [id]);
        for (const item of items) await client.query('UPDATE products SET stock=stock+$1, updated_at=now() WHERE id=$2', [item.quantity, item.product_id]);
      }
      await client.query('UPDATE orders SET status=$1, updated_at=now() WHERE id=$2', [status, id]);
      if (status === 'paid') await client.query("UPDATE payments SET status='paid', updated_at=now() WHERE order_id=$1", [id]);
      if (status === 'refunded') await client.query("UPDATE payments SET status='refunded', updated_at=now() WHERE order_id=$1", [id]);
      if (status === 'shipped') {
        await client.query(
          `INSERT INTO shipments (order_id,carrier,tracking_number,tracking_url,shipped_at)
           VALUES ($1,$2,$3,$4,now()) ON CONFLICT (order_id) DO UPDATE SET
           carrier=EXCLUDED.carrier,tracking_number=EXCLUDED.tracking_number,tracking_url=EXCLUDED.tracking_url,shipped_at=now(),updated_at=now()`,
          [id, String(input.carrier || '').slice(0, 120), String(input.trackingNumber || '').slice(0, 200), trackingUrl.slice(0, 1000)],
        );
      }
      if (status === 'delivered') await client.query('UPDATE shipments SET delivered_at=now(),updated_at=now() WHERE order_id=$1', [id]);
      return { id, status };
    });
    if (!result) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ order: result });
  } catch (error) {
    console.error('Order update failed:', error?.message);
    return NextResponse.json({ error: 'Pesanan belum dapat diperbarui.' }, { status: 500 });
  }
}
