import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { reconcileStaleShipments } from '@/lib/jubelio-shipping';

export const runtime = 'nodejs';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  try {
    const input = await request.json().catch(() => ({}));
    const olderThanMinutes = Number(input.olderThanMinutes ?? process.env.RECONCILE_STALE_AFTER_MINUTES ?? 60);
    if (!Number.isFinite(olderThanMinutes) || olderThanMinutes < 0 || olderThanMinutes > 10080) {
      return NextResponse.json({ error: 'Rentang rekonsiliasi harus 0–10080 menit.' }, { status: 400 });
    }
    return NextResponse.json({ result: await reconcileStaleShipments({ olderThanMinutes }) });
  } catch (error) {
    console.error('Jubelio reconciliation failed:', error?.code || error?.message);
    return NextResponse.json({ error: 'Rekonsiliasi pengiriman belum dapat dijalankan.' }, { status: 502 });
  }
}
