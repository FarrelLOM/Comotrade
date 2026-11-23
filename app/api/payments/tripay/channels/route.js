import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getTripayConfig, getTripayPaymentChannels } from '@/lib/tripay';

export const runtime = 'nodejs';

export async function GET(request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const config = getTripayConfig(request);
    const channels = await getTripayPaymentChannels(config);
    if (!channels.length) {
      return NextResponse.json({ error: 'Tidak ada kanal pembayaran aktif di akun Tripay.' }, { status: 503 });
    }
    return NextResponse.json({ channels }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Tripay payment channels failed:', error?.message);
    return NextResponse.json({ error: 'Kanal pembayaran Tripay belum dapat dimuat.' }, { status: 503 });
  }
}
