import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { cancelShipmentForOrder, createShipmentForOrder, resolveUnknownShipment } from '@/lib/jubelio-shipping';

export const runtime = 'nodejs';

async function getAdmin() {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 }) };
  if (user.role !== 'admin') return { response: NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 }) };
  return { user };
}

export async function POST(_request, { params }) {
  const auth = await getAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const shipment = await createShipmentForOrder(id);
    return NextResponse.json({ shipment }, { status: 201 });
  } catch (error) {
    console.error('Jubelio shipment creation failed:', error?.code || error?.message);
    return NextResponse.json({ error: error?.code?.startsWith('JUBELIO_') ? 'Pembuatan resi gagal atau hasilnya belum diketahui. Periksa status sebelum mencoba lagi.' : error?.message || 'Resi belum dapat dibuat.' }, { status: error?.status || (error?.code?.startsWith('JUBELIO_') ? 502 : 500) });
  }
}

export async function DELETE(request, { params }) {
  const auth = await getAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const input = await request.json().catch(() => ({}));
    const result = await cancelShipmentForOrder(id, input.reason);
    return NextResponse.json({ shipment: result });
  } catch (error) {
    console.error('Jubelio shipment cancellation failed:', error?.code || error?.message);
    return NextResponse.json({ error: error?.message || 'Pembatalan resi belum dapat diproses.' }, { status: error?.status || 502 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await getAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const result = await resolveUnknownShipment(id, await request.json().catch(() => ({})));
    return NextResponse.json({ shipment: result });
  } catch (error) {
    console.error('Jubelio shipment resolution failed:', error?.code || error?.message);
    return NextResponse.json({ error: error?.message || 'Percobaan resi belum dapat diselesaikan.' }, { status: error?.status || 502 });
  }
}
