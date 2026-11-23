import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withTransaction } from '@/lib/db';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const { id: warehouseId } = await params;
  try {
    const input = await request.json();
    if (!Array.isArray(input.products) || input.products.length > 5000) {
      return NextResponse.json({ error: 'Daftar stok gudang tidak valid.' }, { status: 400 });
    }
    const inventory = input.products.map((item) => ({
      productId: String(item?.productId || ''),
      stock: Number(item?.stock),
    }));
    if (inventory.some((item) =>
      !/^[0-9a-f-]{36}$/i.test(item.productId) ||
      !Number.isSafeInteger(item.stock) || item.stock < 0 || item.stock > 2_147_483_647) ||
      new Set(inventory.map((item) => item.productId)).size !== inventory.length) {
      return NextResponse.json({ error: 'Setiap produk harus memiliki ID valid dan stok bilangan bulat nonnegatif.' }, { status: 400 });
    }

    await withTransaction(async (tx) => {
      const { rows: existingSnapshot } = await tx.query(
        'SELECT product_id FROM warehouse_inventory WHERE warehouse_id=?',
        [warehouseId],
      );
      const affectedIds = [...new Set([...existingSnapshot.map((item) => item.product_id), ...inventory.map((item) => item.productId)])].sort();
      if (affectedIds.length) {
        const placeholders = affectedIds.map(() => '?').join(',');
        const { rows: products } = await tx.query(
          `SELECT id FROM products WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
          affectedIds,
        );
        if (products.length !== affectedIds.length) throw Object.assign(new Error('Satu atau beberapa produk tidak ditemukan.'), { status: 404 });
      }
      const { rows: warehouses } = await tx.query('SELECT id,is_active FROM warehouses WHERE id=? FOR UPDATE', [warehouseId]);
      if (!warehouses[0]) throw Object.assign(new Error('Gudang tidak ditemukan.'), { status: 404 });
      if (!warehouses[0].is_active) throw Object.assign(new Error('Aktifkan gudang sebelum mengatur stok.'), { status: 409 });
      await tx.query('SELECT product_id FROM warehouse_inventory WHERE warehouse_id=? FOR UPDATE', [warehouseId]);

      if (inventory.length) {
        await tx.query(
          `DELETE FROM warehouse_inventory WHERE warehouse_id=? AND product_id IN (${inventory.map(() => '?').join(',')})`,
          [warehouseId, ...inventory.map((item) => item.productId)],
        );
      }
      for (const item of inventory) {
        await tx.query(
          'INSERT INTO warehouse_inventory (warehouse_id,product_id,stock) VALUES (?,?,?)',
          [warehouseId, item.productId, item.stock],
        );
      }
      for (const productId of affectedIds) {
        await tx.query(
          `UPDATE products SET stock=(
            SELECT COALESCE(SUM(stock),0) FROM warehouse_inventory WHERE product_id=?
          ),updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          [productId, productId],
        );
      }
    });
    return NextResponse.json({ ok: true, products: inventory });
  } catch (error) {
    console.error('Warehouse inventory update failed:', error?.message);
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ error: 'Tabel gudang belum dibuat. Jalankan npm run db:migrate pada database deployment.' }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message || 'Stok gudang belum dapat disimpan.' }, { status: error?.status || 500 });
  }
}
