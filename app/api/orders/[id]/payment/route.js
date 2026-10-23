import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { createTripayTransaction, getTripayConfig } from '@/lib/tripay';

export const runtime = 'nodejs';

function parseItems(items) {
  return typeof items === 'string' ? JSON.parse(items) : items || [];
}

export async function POST(_request, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  const { id } = await params;

  let config;
  try {
    config = getTripayConfig();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  try {
    const { rows } = await query(
      `SELECT o.id, o.status, o.total, u.full_name AS customer_name, u.email AS customer_email,
              p.status AS payment_status, p.merchant_ref, p.payment_url, p.payment_method,
              p.payment_code, p.expires_at
       FROM orders o JOIN users u ON u.id = o.user_id
       JOIN payments p ON p.order_id = o.id
       WHERE o.id = ? AND o.user_id = ? AND p.provider = 'tripay'`,
      [id, user.id],
    );
    const order = rows[0];
    if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    if (order.status !== 'pending_payment' || ['paid', 'refunded'].includes(order.payment_status)) {
      return NextResponse.json({ error: 'Pesanan ini tidak dapat dibayar.' }, { status: 409 });
    }
    if (order.payment_url && order.payment_status === 'pending') {
      return NextResponse.json({ payment: order });
    }

    const { rows: itemRows } = await query(
      `SELECT id, product_name AS name, unit_price AS price, quantity,
              unit_price * quantity AS subtotal
       FROM order_items WHERE order_id = ?`,
      [id],
    );
    const merchantRef = order.payment_status === 'failed' ? `COMO-${randomUUID()}` : order.merchant_ref;
    if (merchantRef !== order.merchant_ref) {
      await query(
        `UPDATE payments SET merchant_ref = ?, provider_reference = NULL, payment_url = NULL,
           payment_code = NULL, expires_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ? AND status = 'failed'`,
        [merchantRef, id],
      );
    }

    const transaction = await createTripayTransaction(config, {
      ...order,
      merchant_ref: merchantRef,
      items: itemRows.map((item) => ({
        sku: item.id,
        name: item.name,
        price: Math.round(Number(item.price)),
        quantity: item.quantity,
        subtotal: Math.round(Number(item.subtotal)),
      })),
    });
    const paymentUrl = transaction.checkout_url || transaction.pay_url;
    if (!paymentUrl || !transaction.reference) {
      throw new Error('Tripay returned an incomplete payment instruction.');
    }

    const expiresAt = transaction.expired_time
      ? new Date(Number(transaction.expired_time) * 1000)
      : null;
    await withTransaction(async (client) => {
      const { rows: locked } = await client.query(
        'SELECT status FROM payments WHERE order_id = ? FOR UPDATE',
        [id],
      );
      if (!locked[0] || ['paid', 'refunded'].includes(locked[0].status)) {
        throw new Error('Pembayaran sudah diproses sebelum instruksi pembayaran tersimpan.');
      }
      await client.query(
        `UPDATE payments SET status = 'pending', provider_reference = ?, payment_url = ?,
           payment_method = ?, payment_code = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [
          String(transaction.reference),
          paymentUrl,
          String(transaction.payment_method || config.paymentMethod).slice(0, 40),
          transaction.pay_code ? String(transaction.pay_code) : null,
          expiresAt,
          id,
        ],
      );
    });

    return NextResponse.json({
      payment: {
        reference: String(transaction.reference),
        payment_url: paymentUrl,
        payment_method: transaction.payment_method || config.paymentMethod,
        payment_code: transaction.pay_code || null,
        expires_at: expiresAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Tripay payment creation failed:', error?.message);
    return NextResponse.json({ error: 'Instruksi pembayaran belum dapat dibuat. Silakan coba lagi.' }, { status: 502 });
  }
}
