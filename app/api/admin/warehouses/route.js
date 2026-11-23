import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { normalizeWarehouseInput } from '@/lib/warehouse-validation.mjs';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  try {
    const [{ rows: warehouses }, { rows: inventory }] = await Promise.all([
      query('SELECT * FROM warehouses ORDER BY is_active DESC, is_default DESC, name'),
      query(
        `SELECT wi.warehouse_id, wi.product_id, wi.stock
         FROM warehouse_inventory wi JOIN products p ON p.id = wi.product_id
         WHERE p.is_active = TRUE ORDER BY p.name`,
      ),
    ]);
    return NextResponse.json({ warehouses, inventory }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Warehouse listing failed:', error?.message);
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ error: 'Tabel gudang belum dibuat. Jalankan npm run db:migrate pada database deployment.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Data gudang belum tersedia. Jalankan migrasi database.' }, { status: 503 });
  }
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  try {
    const warehouse = normalizeWarehouseInput(await request.json());
    const id = randomUUID();
    const isDefault = await withTransaction(async (tx) => {
      await tx.query('SELECT id FROM products ORDER BY id FOR UPDATE');
      const { rows: current } = await tx.query('SELECT id,is_default,is_active FROM warehouses ORDER BY id FOR UPDATE');
      const hasActiveDefault = current.some((item) => item.is_default && item.is_active);
      const makeDefault = warehouse.isActive && (warehouse.isDefault || !hasActiveDefault);
      if (makeDefault) await tx.query('UPDATE warehouses SET is_default = FALSE WHERE is_default = TRUE');
      await tx.query(
        `INSERT INTO warehouses (
          id,name,description,phone,email,address_line,area_name,district_name,city_name,province_name,
          area_id,zipcode,coordinate,is_default,is_active
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, warehouse.name, warehouse.description, warehouse.phone, warehouse.email || null,
          warehouse.addressLine, warehouse.areaName, warehouse.districtName, warehouse.cityName,
          warehouse.provinceName, warehouse.areaId, warehouse.zipcode, warehouse.coordinate || null,
          makeDefault, warehouse.isActive,
        ],
      );
      if (current.length === 0) {
        await tx.query(
          `INSERT INTO warehouse_inventory (warehouse_id, product_id, stock)
           SELECT ?, id, stock FROM products`,
          [id],
        );
      }
      return makeDefault;
    });
    return NextResponse.json({ warehouse: { id, ...warehouse, isDefault } }, { status: 201 });
  } catch (error) {
    console.error('Warehouse creation failed:', error?.message);
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ error: 'Tabel gudang belum dibuat. Jalankan npm run db:migrate pada database deployment.' }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message || 'Gudang belum dapat disimpan.' }, { status: error?.status || 500 });
  }
}
