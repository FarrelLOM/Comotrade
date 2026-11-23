import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
import { normalizeWarehouseInput } from '@/lib/warehouse-validation.mjs';

export const runtime = 'nodejs';

export async function PATCH(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const { id } = await params;
  try {
    const warehouse = normalizeWarehouseInput(await request.json());
    const updated = await withTransaction(async (tx) => {
      const { rows } = await tx.query('SELECT id,is_default FROM warehouses WHERE id = ? FOR UPDATE', [id]);
      if (!rows[0]) return false;
      const { rows: currentDefaults } = await tx.query(
        'SELECT id FROM warehouses WHERE is_active=TRUE AND is_default=TRUE AND id<>? LIMIT 1 FOR UPDATE',
        [id],
      );
      const isDefault = warehouse.isActive && (warehouse.isDefault || !currentDefaults.length);
      if (isDefault) await tx.query('UPDATE warehouses SET is_default = FALSE WHERE is_default = TRUE AND id <> ?', [id]);
      await tx.query(
        `UPDATE warehouses SET name=?,description=?,phone=?,email=?,address_line=?,area_name=?,
         district_name=?,city_name=?,province_name=?,area_id=?,zipcode=?,coordinate=?,is_default=?,is_active=?,
         updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [
          warehouse.name, warehouse.description, warehouse.phone, warehouse.email || null,
          warehouse.addressLine, warehouse.areaName, warehouse.districtName, warehouse.cityName,
          warehouse.provinceName, warehouse.areaId, warehouse.zipcode, warehouse.coordinate || null,
          isDefault, warehouse.isActive, id,
        ],
      );
      if (rows[0].is_default && !isDefault) {
        const { rows: next } = await tx.query(
          'SELECT id FROM warehouses WHERE is_active=TRUE ORDER BY name LIMIT 1 FOR UPDATE',
        );
        if (next[0] && next[0].id !== id) await tx.query('UPDATE warehouses SET is_default=TRUE WHERE id=?', [next[0].id]);
      }
      return { isDefault };
    });
    if (!updated) return NextResponse.json({ error: 'Gudang tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ warehouse: { id, ...warehouse, isDefault: updated.isDefault } });
  } catch (error) {
    console.error('Warehouse update failed:', error?.message);
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ error: 'Tabel gudang belum dibuat. Jalankan npm run db:migrate pada database deployment.' }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message || 'Gudang belum dapat diperbarui.' }, { status: error?.status || 500 });
  }
}

export async function DELETE(_request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const { id } = await params;
  try {
    const result = await withTransaction(async (tx) => {
      const { rows } = await tx.query('SELECT id,is_default FROM warehouses WHERE id = ? FOR UPDATE', [id]);
      if (!rows[0]) return false;
      await tx.query('UPDATE warehouses SET is_active=FALSE,is_default=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
      if (rows[0].is_default) {
        const { rows: next } = await tx.query('SELECT id FROM warehouses WHERE is_active=TRUE ORDER BY name LIMIT 1 FOR UPDATE');
        if (next[0]) await tx.query('UPDATE warehouses SET is_default=TRUE WHERE id=?', [next[0].id]);
      }
      return true;
    });
    if (!result) return NextResponse.json({ error: 'Gudang tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Warehouse deactivation failed:', error?.message);
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ error: 'Tabel gudang belum dibuat. Jalankan npm run db:migrate pada database deployment.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Gudang belum dapat dinonaktifkan.' }, { status: 500 });
  }
}
