import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';

export const runtime = 'nodejs';
const transitions = {
  pending_payment: new Set(['payment_review', 'cancelled']),
  payment_review: new Set(['cancelled']),
  paid: new Set(['processing']),
  processing: new Set(),
  shipped: new Set(),
  delivered: new Set(),
  returned: new Set(),
  cancelled: new Set(),
  refunded: new Set(),
};

function parseItems(items) {
  return typeof items === 'string' ? JSON.parse(items) : items || [];
}

export async function GET(_request, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  const { id } = await params;
  try {
    const { rows } = await query(
      `SELECT o.*,
              COALESCE((
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                  'id', oi.id, 'product_id', oi.product_id, 'name', oi.product_name,
                  'unit_price', oi.unit_price, 'quantity', oi.quantity, 'line_total', oi.line_total
                ))
                FROM order_items oi WHERE oi.order_id = o.id
              ), JSON_ARRAY()) AS items,
              JSON_OBJECT(
                'carrier', COALESCE(js.courier_name, s.carrier),
                'tracking_number', COALESCE(js.awb, s.tracking_number),
                'tracking_url', COALESCE(js.tracking_url, s.tracking_url),
                'state', js.state, 'jubelio_status', js.jubelio_status,
                'attempt_id', js.id, 'carrier_price', js.carrier_price, 'price_drift', js.price_drift
              ) AS shipment,
              p.status AS payment_status, p.provider AS payment_provider,
              p.payment_url, p.payment_method, p.payment_code, p.expires_at
       FROM orders o
       LEFT JOIN shipments s ON s.order_id = o.id
       LEFT JOIN jubelio_shipment_attempts js ON js.id = (
         SELECT ja.id FROM jubelio_shipment_attempts ja WHERE ja.order_id = o.id ORDER BY ja.attempt_no DESC LIMIT 1
       )
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.id = ? AND (? = TRUE OR o.user_id = ?)`,
      [id, user.role === 'admin', user.id],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ order: { ...rows[0], items: parseItems(rows[0].items) } });
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
    if (!Object.hasOwn(transitions, status)) return NextResponse.json({ error: 'Status tidak diizinkan.' }, { status: 400 });
    const trackingUrl = String(input.trackingUrl || '').trim();
    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      return NextResponse.json({ error: 'URL tracking harus menggunakan HTTP(S).' }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT id, status FROM orders WHERE id = ? FOR UPDATE', [id]);
      const current = rows[0];
      if (!current) return { missing: true };
      if (!transitions[current.status]?.has(status)) {
        return { invalidTransition: true, currentStatus: current.status };
      }

      if (status === 'cancelled') {
        const { rows: activeShipments } = await client.query(
          `SELECT id FROM jubelio_shipment_attempts
           WHERE order_id = ? AND state IN ('CREATING','CREATED','UNKNOWN') LIMIT 1 FOR UPDATE`,
          [id],
        );
        if (activeShipments.length) return { shipmentActive: true };
        const { rows: items } = await client.query(
          'SELECT product_id, quantity FROM order_items WHERE order_id = ? AND product_id IS NOT NULL',
          [id],
        );
        for (const item of items) {
          await client.query(
            'UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [item.quantity, item.product_id],
          );
        }
      }
      await client.query('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
      if (status === 'paid') {
        await client.query(
          `UPDATE payments SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
          [id],
        );
      }
      return { id, status };
    });
    if (result.missing) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    if (result.shipmentActive) return NextResponse.json({ error: 'Batalkan atau selesaikan resi Jubelio sebelum membatalkan pesanan.' }, { status: 409 });
    if (result.invalidTransition) {
      return NextResponse.json({ error: `Perubahan status ${result.currentStatus} menjadi ${status} tidak diizinkan.` }, { status: 409 });
    }
    return NextResponse.json({ order: result });
  } catch (error) {
    console.error('Order update failed:', error?.message);
    return NextResponse.json({ error: 'Pesanan belum dapat diperbarui.' }, { status: 500 });
  }
}
