import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { isValidCloudinaryOrLocalUrl } from '@/lib/cloudinary.mjs';

export const runtime = 'nodejs';

function parseLines(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

export async function GET() {
  try {
    const { rows } = await query(
      `SELECT id, slug, name, category, description, long_description, harvest_duration, highlights_json, gallery_json,
              price, stock, satuan, origin, image_url, shipping_weight_gram, shipping_length_cm,
              shipping_width_cm, shipping_height_cm, created_at
       FROM products WHERE is_active = TRUE ORDER BY created_at DESC`,
    );
    return NextResponse.json({ products: rows });
  } catch (error) {
    console.error('Product listing failed:', error?.message);
    return NextResponse.json({ error: 'Katalog database belum siap.' }, { status: 503 });
  }
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  try {
    const input = await request.json();
    const name = String(input.name || '').trim();
    const category = String(input.category || 'Rempah').trim();
    const slug = String(input.slug || '').trim().toLowerCase();
    const description = String(input.description || '').trim();
    const longDescription = String(input.longDescription || '').trim();
    const highlights = parseLines(input.highlights);
    const gallery = parseLines(input.gallery);
    const origin = String(input.origin || '').trim();
    const harvestDuration = String(input.harvestDuration || '').trim().slice(0, 120);
    const imageUrl = String(input.imageUrl || '').trim();
    const price = Number(input.price);
    const stock = Number(input.stock);
    const warehouseId = String(input.warehouseId || '').trim();
    const satuan = String(input.satuan || 'unit').trim();
    const shippingWeight = input.shippingWeightGram === '' || input.shippingWeightGram == null ? null : Number(input.shippingWeightGram);
    const shippingLength = input.shippingLengthCm === '' || input.shippingLengthCm == null ? null : Number(input.shippingLengthCm);
    const shippingWidth = input.shippingWidthCm === '' || input.shippingWidthCm == null ? null : Number(input.shippingWidthCm);
    const shippingHeight = input.shippingHeightCm === '' || input.shippingHeightCm == null ? null : Number(input.shippingHeightCm);
    const packageValues = [shippingWeight, shippingLength, shippingWidth, shippingHeight];
    if (name.length < 2 || name.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ error: 'Nama atau slug produk tidak valid.' }, { status: 400 });
    }
    if (!Number.isInteger(price) || price < 0 || !Number.isInteger(stock) || stock < 0 || description.length > 10000 || longDescription.length > 20000 || !satuan || satuan.length > 40 || harvestDuration.length > 120) {
      return NextResponse.json({ error: 'Harga, stok, atau deskripsi tidak valid.' }, { status: 400 });
    }
    if (highlights.length > 12 || highlights.some((item) => item.length > 300)) return NextResponse.json({ error: 'Poin produk maksimal 12 butir, masing-masing 300 karakter.' }, { status: 400 });
    if (gallery.length > 12 || gallery.some((image) => image.length > 1000 || !isValidCloudinaryOrLocalUrl(image))) return NextResponse.json({ error: 'Galeri maksimal 12 URL gambar HTTP(S) atau path lokal.' }, { status: 400 });
    if (packageValues.some((value) => value !== null && (!Number.isSafeInteger(value) || value <= 0)) || (packageValues.some((value) => value !== null) && packageValues.some((value) => value === null))) {
      return NextResponse.json({ error: 'Isi berat gram dan ketiga dimensi cm sekaligus dengan bilangan bulat positif, atau kosongkan semuanya.' }, { status: 400 });
    }
    if (imageUrl && !isValidCloudinaryOrLocalUrl(imageUrl)) {
      return NextResponse.json({ error: 'URL gambar harus berupa path lokal atau HTTP(S).' }, { status: 400 });
    }
    if (warehouseId && !/^[0-9a-f-]{36}$/i.test(warehouseId)) {
      return NextResponse.json({ error: 'Gudang produk tidak valid.' }, { status: 400 });
    }

    const id = randomUUID();
    await withTransaction(async (tx) => {
      const { rows: warehouses } = warehouseId
        ? await tx.query('SELECT id FROM warehouses WHERE id=? AND is_active=TRUE FOR UPDATE', [warehouseId])
        : await tx.query('SELECT id FROM warehouses WHERE is_active=TRUE ORDER BY is_default DESC,name LIMIT 1 FOR UPDATE');
      if (!warehouses[0]) {
        throw Object.assign(
          new Error(warehouseId ? 'Gudang pilihan tidak ditemukan atau nonaktif.' : 'Buat gudang aktif sebelum mendaftarkan produk.'),
          { status: 409 },
        );
      }
      await tx.query(
        `INSERT INTO products (
           id, slug, name, category, description, long_description, harvest_duration, highlights_json, gallery_json,
           price, stock, satuan, origin, image_url,
           shipping_weight_gram, shipping_length_cm, shipping_width_cm, shipping_height_cm, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`,
        [id, slug, name, category.slice(0, 120), description, longDescription, harvestDuration || null, JSON.stringify(highlights), JSON.stringify(gallery), price, stock, satuan, origin.slice(0, 300), imageUrl.slice(0, 1000), shippingWeight, shippingLength, shippingWidth, shippingHeight, admin.id],
      );
      if (warehouses[0]) {
        await tx.query(
          'INSERT INTO warehouse_inventory (warehouse_id,product_id,stock) VALUES (?,?,?)',
          [warehouses[0].id, id, stock],
        );
      }
    });
    const { rows } = await query(
      `SELECT id, slug, name, category, description, long_description, harvest_duration, highlights_json, gallery_json,
              price, stock, satuan, origin, image_url, shipping_weight_gram, shipping_length_cm,
              shipping_width_cm, shipping_height_cm
       FROM products WHERE id = ?`,
      [id],
    );
    return NextResponse.json({ product: rows[0] }, { status: 201 });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Slug sudah digunakan.' }, { status: 409 });
    console.error('Product creation failed:', error?.message);
    return NextResponse.json({ error: error?.message || 'Produk belum dapat disimpan.' }, { status: error?.status || 500 });
  }
}
