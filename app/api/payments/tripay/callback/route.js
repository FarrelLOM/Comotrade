import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { verifyTripayCallback } from '@/lib/tripay';

export const runtime = 'nodejs';

export async function POST(request) {
  const privateKey = process.env.TRIPAY_PRIVATE_KEY;
  if (!privateKey) return NextResponse.json({ error: 'Callback belum dikonfigurasi.' }, { status: 503 });

  const rawBody = await request.text();
  if (!verifyTripayCallback(rawBody, request.headers.get('X-Callback-Signature'), privateKey)) {
    return NextResponse.json({ error: 'Signature callback tidak valid.' }, { status: 401 });
  }

  try {
    const event = request.headers.get('X-Callback-Event');
    if (event && event !== 'payment_status') {
      return NextResponse.json({ error: 'Jenis callback tidak didukung.' }, { status: 400 });
    }
    const payload = JSON.parse(rawBody);
    const data = payload.data;
    const merchantRef = String(data?.merchant_ref || '');
    const reference = String(data?.reference || '');
    const status = String(data?.status || '').toUpperCase();
    const totalAmount = Number(data?.total_amount);
    if (!merchantRef || !reference || !Number.isSafeInteger(totalAmount) ||
        !['PAID', 'UNPAID', 'EXPIRED'].includes(status)) {
      return NextResponse.json({ error: 'Payload callback tidak valid.' }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT p.order_id, p.amount, p.status AS payment_status, p.provider_reference,
                p.merchant_ref, o.status AS order_status
         FROM payments p JOIN orders o ON o.id = p.order_id
         WHERE p.merchant_ref = ? AND p.provider = 'tripay' FOR UPDATE`,
        [merchantRef],
      );
      const payment = rows[0];
      if (!payment) return { missing: true };
      if (Math.round(Number(payment.amount)) !== totalAmount) return { amountMismatch: true };
      if (payment.provider_reference && payment.provider_reference !== reference) {
        return { referenceMismatch: true };
      }
      if (payment.payment_status === 'paid') return { alreadyProcessed: true };
      if (['cancelled', 'refunded'].includes(payment.order_status)) {
        return { orderClosed: true };
      }

      if (status === 'PAID') {
        if (!['pending_payment', 'payment_review'].includes(payment.order_status)) {
          return { orderClosed: true };
        }
        await client.query(
          `UPDATE payments SET status = 'paid', provider_reference = ?, updated_at = CURRENT_TIMESTAMP
           WHERE order_id = ?`,
          [reference, payment.order_id],
        );
        await client.query(
          `UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [payment.order_id],
        );
      } else if (status === 'EXPIRED') {
        await client.query(
          `UPDATE payments SET status = 'failed', provider_reference = ?, payment_url = NULL,
             payment_code = NULL, expires_at = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE order_id = ?`,
          [reference, payment.order_id],
        );
      } else if (!payment.provider_reference) {
        await client.query(
          'UPDATE payments SET provider_reference = ? WHERE order_id = ?',
          [reference, payment.order_id],
        );
      }
      return { accepted: true };
    });

    if (result.missing) return NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 });
    if (result.amountMismatch || result.referenceMismatch || result.orderClosed) {
      return NextResponse.json({ error: 'Data callback tidak sesuai dengan transaksi.' }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tripay callback processing failed:', error?.message);
    return NextResponse.json({ error: 'Callback belum dapat diproses.' }, { status: 500 });
  }
}
