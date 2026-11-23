import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAvailableShippingWarehouses, getShippingQuotes, loadShippingProducts, parseProductIds } from '@/lib/jubelio-shipping';
import { filterCargoQuotes } from '@/lib/jubelio-core.mjs';

export const runtime = 'nodejs';

function parseCoordinate(value) {
  if (value == null || value === '') return null;
  const parts = String(value).split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part)) || Math.abs(parts[0]) > 90 || Math.abs(parts[1]) > 180) return null;
  return `${parts[0]},${parts[1]}`;
}

export async function POST(request) {
  const user = await getCurrentUser();
  try {
    const input = await request.json();
    const addressId = String(input.addressId || '');
    let savedAddress = null;
    if (addressId) {
      if (!user) return NextResponse.json({ error: 'Login diperlukan untuk memakai alamat tersimpan.' }, { status: 401 });
      if (!/^[0-9a-f-]{36}$/i.test(addressId)) {
        return NextResponse.json({ error: 'Pilih alamat pengiriman terlebih dahulu.' }, { status: 400 });
      }
      const { rows: addresses } = await query(
        'SELECT area_id, zipcode, coordinate, area_name, district_name, city_name, province_name FROM user_addresses WHERE id = ? AND user_id = ?',
        [addressId, user.id],
      );
      savedAddress = addresses[0] || null;
      if (!savedAddress) return NextResponse.json({ error: 'Alamat tidak ditemukan.' }, { status: 404 });
    }
    const suppliedCoordinate = input.destination?.coordinate;
    const coordinate = parseCoordinate(suppliedCoordinate);
    if (suppliedCoordinate && !coordinate) return NextResponse.json({ error: 'Titik peta tidak valid.' }, { status: 400 });
    const destinationInput = input.destination || {};
    const destination = {
      areaId: String(destinationInput.areaId || savedAddress?.area_id || '').trim(),
      zipcode: String(destinationInput.zipcode || savedAddress?.zipcode || '').trim(),
      coordinate: coordinate || savedAddress?.coordinate || null,
    };
    if (!/^\d{10}$/.test(destination.areaId) || !/^\d{4,10}$/.test(destination.zipcode)) {
      return NextResponse.json({ error: 'Pilih kelurahan dan kode pos yang valid.' }, { status: 400 });
    }

    const quantities = parseProductIds(input.items);
    const products = await loadShippingProducts(quantities);
    const warehouses = await getAvailableShippingWarehouses(products);
    if (!warehouses.length) {
      return NextResponse.json({ error: 'Tidak ada satu gudang aktif yang memiliki stok lengkap untuk semua produk pesanan.' }, { status: 409 });
    }
    const results = await Promise.all(warehouses.map(async (warehouse) => {
      const result = await getShippingQuotes({ products, destination, origin: warehouse.origin });
      return {
        ...result,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        quotes: result.quotes.map((quote) => ({
          ...quote,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
        })),
      };
    }));
    const totalQuantity = [...quantities.values()].reduce((sum, quantity) => sum + quantity, 0);
    const quotes = filterCargoQuotes(results.flatMap((result) => result.quotes), totalQuantity);
    if (!quotes.length) return NextResponse.json({ error: totalQuantity > 30 ? 'Untuk jumlah di atas 30, tidak ada layanan Cargo yang tersedia di alamat ini.' : 'Tidak ada layanan kurir untuk alamat dan paket ini.' }, { status: 404 });
    const selectedWarehouseResult = results.find((result) => result.quotes.length);
    return NextResponse.json({
      subtotal: selectedWarehouseResult.package.totalValue,
      package: selectedWarehouseResult.package,
      cargoOnly: totalQuantity > 30,
      quotes,
    });
  } catch (error) {
    console.error('Jubelio rate request failed:', error?.code || 'JUBELIO_ERROR', error?.httpStatus || '');
    const status = error?.code === 'JUBELIO_CREDENTIALS_MISSING' ? 503 : error?.status || 502;
    const message = error?.code === 'JUBELIO_TOKEN_REJECTED' ||
      error?.code === 'JUBELIO_TOKEN_INVALID_RESPONSE' ||
      error?.code === 'JUBELIO_NETWORK' ||
      error?.code === 'JUBELIO_TIMEOUT'
      ? error.message
      : error?.code?.startsWith('JUBELIO_')
        ? 'Layanan ongkir sementara tidak tersedia.'
        : error?.message || 'Tarif pengiriman belum dapat dihitung.';
    return NextResponse.json({ error: message }, { status });
  }
}
