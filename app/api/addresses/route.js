import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';

export const runtime = 'nodejs';

function validateAddress(input) {
  const recipientName = String(input.recipientName || '').trim();
  const recipientPhone = String(input.recipientPhone || '').trim();
  const addressLine = String(input.addressLine || '').trim();
  const areaId = String(input.areaId || '').trim();
  const zipcode = String(input.zipcode || '').trim();
  if (recipientName.length < 2 || recipientName.length > 120 || !/^\+?[0-9 ()-]{7,30}$/.test(recipientPhone) ||
      addressLine.length < 8 || addressLine.length > 1000 || !/^\d{10}$/.test(areaId) || !/^\d{4,10}$/.test(zipcode)) {
    throw Object.assign(new Error('Nama, nomor HP, alamat, kelurahan, atau kode pos tidak valid.'), { status: 400 });
  }
  return {
    label: String(input.label || 'Rumah').trim().slice(0, 60),
    recipientName, recipientPhone, addressLine,
    areaName: String(input.areaName || '').trim().slice(0, 200),
    districtName: String(input.districtName || '').trim().slice(0, 200),
    cityName: String(input.cityName || '').trim().slice(0, 200),
    provinceName: String(input.provinceName || '').trim().slice(0, 200),
    areaId, zipcode,
    coordinate: String(input.coordinate || '').trim().slice(0, 80) || null,
    isDefault: Boolean(input.isDefault),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const { rows } = await query(
      'SELECT id, label, recipient_name, recipient_phone, address_line, area_name, district_name, city_name, province_name, area_id, zipcode, coordinate, is_default, created_at FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [user.id],
    );
    return NextResponse.json({ addresses: rows }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Address listing failed:', error?.message);
    return NextResponse.json({ error: 'Alamat belum tersedia. Jalankan migrasi database terlebih dahulu.' }, { status: 503 });
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const address = validateAddress(await request.json());
    const id = randomUUID();
    await withTransaction(async (tx) => {
      const { rows } = await tx.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [user.id]);
      if (!rows[0]) throw Object.assign(new Error('Akun tidak ditemukan.'), { status: 404 });
      const { rows: addressState } = await tx.query('SELECT COUNT(*) AS total, MAX(is_default) AS has_default FROM user_addresses WHERE user_id = ?', [user.id]);
      const makeDefault = address.isDefault || Number(addressState[0]?.total || 0) === 0 || !Boolean(addressState[0]?.has_default);
      if (makeDefault) await tx.query('UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?', [user.id]);
      await tx.query(
        `INSERT INTO user_addresses (
          id,user_id,label,recipient_name,recipient_phone,address_line,area_name,district_name,
          city_name,province_name,area_id,zipcode,coordinate,is_default
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id,user.id,address.label,address.recipientName,address.recipientPhone,address.addressLine,
          address.areaName,address.districtName,address.cityName,address.provinceName,address.areaId,
          address.zipcode,address.coordinate,makeDefault],
      );
    });
    return NextResponse.json({ address: { id, ...address } }, { status: 201 });
  } catch (error) {
    console.error('Address creation failed:', error?.message);
    return NextResponse.json({ error: error?.message || 'Alamat belum dapat disimpan.' }, { status: error?.status || 500 });
  }
}
