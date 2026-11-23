import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get('lat'));
  const longitude = Number(params.get('lon'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: 'Titik peta tidak valid.' }, { status: 400 });
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.search = new URLSearchParams({
      format: 'jsonv2',
      lat: String(latitude),
      lon: String(longitude),
      zoom: '18',
      addressdetails: '1',
    }).toString();
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'id',
        'User-Agent': 'Comotrade/1.0 (delivery address lookup)',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (!response.ok || !data.address) {
      return NextResponse.json({ error: 'Alamat untuk titik ini belum ditemukan.' }, { status: 502 });
    }
    if (data.address.country_code !== 'id') {
      return NextResponse.json({ error: 'Pengiriman saat ini hanya tersedia untuk lokasi di Indonesia.' }, { status: 422 });
    }
    return NextResponse.json({
      address: data.address,
      displayName: String(data.display_name || ''),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Reverse geocoding failed:', error?.message);
    return NextResponse.json({ error: 'Alamat otomatis belum dapat ditemukan. Isi alamat secara manual.' }, { status: 502 });
  }
}
