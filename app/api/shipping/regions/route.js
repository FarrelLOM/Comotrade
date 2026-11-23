import { NextResponse } from 'next/server';
import { searchShippingRegions } from '@/lib/jubelio-shipping';

export const runtime = 'nodejs';

const regionCache = new Map();
const REGION_TTL_MS = 10 * 60 * 1000;

export async function GET(request) {
  try {
    const name = String(new URL(request.url).searchParams.get('q') || '').trim();
    if (name.length < 3) {
      return NextResponse.json({ error: 'Cari wilayah dengan minimal 3 karakter.' }, { status: 400 });
    }
    const key = name.toLocaleLowerCase('id');
    const cached = regionCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ regions: cached.regions });
    }
    const regions = await searchShippingRegions(name);
    if (regionCache.size >= 500) regionCache.clear();
    regionCache.set(key, { regions, expiresAt: Date.now() + REGION_TTL_MS });
    return NextResponse.json({ regions });
  } catch (error) {
    const status = error?.code === 'JUBELIO_CREDENTIALS_MISSING' ? 503 : error?.status || 502;
    return NextResponse.json({ error: error?.message || 'Pencarian wilayah belum tersedia.' }, { status });
  }
}
