import { NextResponse } from 'next/server';
import { processJubelioWebhook, receiveJubelioWebhook } from '@/lib/jubelio-shipping';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request) {
  const rawBody = await request.text();
  let received;
  try {
    received = await receiveJubelioWebhook(rawBody, request.headers.get('x-jubelio-signature'));
  } catch (error) {
    console.error('Jubelio webhook persistence failed:', error?.code || error?.message);
    return NextResponse.json({ error: 'Webhook belum dapat disimpan.' }, { status: 503 });
  }
  if (!received.accepted) {
    return NextResponse.json({ error: received.status === 401 ? 'Signature webhook tidak valid.' : 'Payload webhook tidak valid.' }, { status: received.status });
  }
  if (received.duplicate && !received.needsProcessing) return NextResponse.json({ ok: true, duplicate: true });

  const { key, payload } = received;
  setImmediate(async () => {
    try {
      await processJubelioWebhook(key, payload);
    } catch (error) {
      console.error('Jubelio webhook processing failed:', error?.code || error?.message);
      await query(
        'UPDATE jubelio_webhook_events SET processing_error = ? WHERE dedupe_key = ?',
        [String(error?.message || 'Webhook processing failed').slice(0, 500), key],
      ).catch(() => {});
    }
  });
  return NextResponse.json({ ok: true, duplicate: received.duplicate });
}
