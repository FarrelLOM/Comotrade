import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';

export const runtime = 'nodejs';

function validateAddress(input) {
  const values = {
    label: String(input.label || 'Rumah').trim().slice(0, 60),
    recipientName: String(input.recipientName || '').trim(),
    recipientPhone: String(input.recipientPhone || '').trim(),
    addressLine: String(input.addressLine || '').trim(),
    areaName: String(input.areaName || '').trim().slice(0, 200),
    districtName: String(input.districtName || '').trim().slice(0, 200),
    cityName: String(input.cityName || '').trim().slice(0, 200),
    provinceName: String(input.provinceName || '').trim().slice(0, 200),
    areaId: String(input.areaId || '').trim(),
    zipcode: String(input.zipcode || '').trim(),
    coordinate: String(input.coordinate || '').trim().slice(0, 80) || null,
    isDefault: Boolean(input.isDefault),
  };
  if (values.recipientName.length < 2 || values.recipientName.length > 120 || !/^\+?[0-9 ()-]{7,30}$/.test(values.recipientPhone) ||
      values.addressLine.length < 8 || values.addressLine.length > 1000 || !/^\d{10}$/.test(values.areaId) || !/^\d{4,10}$/.test(values.zipcode)) {
    throw Object.assign(new Error('Data alamat tidak valid.'), { status: 400 });
  }
  return values;
}

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  const { id } = await params;
  try {
    const address = validateAddress(await request.json());
    const changed = await withTransaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [user.id]);
      const { rows } = await tx.query('SELECT id,is_default FROM user_addresses WHERE id = ? AND user_id = ? FOR UPDATE', [id, user.id]);
      if (!rows[0]) return false;
      const makeDefault = address.isDefault || Boolean(rows[0].is_default);
      if (makeDefault) await tx.query('UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?', [user.id]);
      await tx.query(
        `UPDATE user_addresses SET label=?,recipient_name=?,recipient_phone=?,address_line=?,area_name=?,
         district_name=?,city_name=?,province_name=?,area_id=?,zipcode=?,coordinate=?,is_default=?,updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND user_id=?`,
        [address.label,address.recipientName,address.recipientPhone,address.addressLine,address.areaName,
          address.districtName,address.cityName,address.provinceName,address.areaId,address.zipcode,
          address.coordinate,makeDefault,id,user.id],
      );
      return true;
    });
    if (!changed) return NextResponse.json({ error: 'Alamat tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ address: { id, ...address } });
  } catch (error) {
    console.error('Address update failed:', error?.message);
    return NextResponse.json({ error: error?.message || 'Alamat belum dapat diperbarui.' }, { status: error?.status || 500 });
  }
}

export async function DELETE(_request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  const { id } = await params;
  try {
    const deleted = await withTransaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [user.id]);
      const { rows } = await tx.query('SELECT id,is_default FROM user_addresses WHERE id = ? AND user_id = ? FOR UPDATE', [id,user.id]);
      if (!rows[0]) return false;
      await tx.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [id,user.id]);
      if (rows[0].is_default) {
        const { rows: next } = await tx.query('SELECT id FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1 FOR UPDATE', [user.id]);
        if (next[0]) await tx.query('UPDATE user_addresses SET is_default = TRUE WHERE id = ?', [next[0].id]);
      }
      return true;
    });
    if (!deleted) return NextResponse.json({ error: 'Alamat tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Address deletion failed:', error?.message);
    return NextResponse.json({ error: 'Alamat belum dapat dihapus.' }, { status: 500 });
  }
}
