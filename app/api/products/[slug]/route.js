import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { isValidCloudinaryOrLocalUrl } from '@/lib/cloudinary.mjs';

export const runtime = 'nodejs';

function parseStoredList(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(_request, { params }) {
  try {
    const { slug } = await params;
    const { rows } = await query(
      `SELECT id, slug, name, category, description, long_description, harvest_duration, highlights_json, gallery_json,
              price, stock, satuan, origin, image_url, shipping_weight_gram, shipping_length_cm,
              shipping_width_cm, shipping_height_cm
       FROM products WHERE slug = ? AND is_active = TRUE`,
      [slug],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    const { highlights_json, gallery_json, ...product } = rows[0];
    return NextResponse.json({
      product: {
        ...product,
        long_description: product.long_description || '',
        highlights: parseStoredList(highlights_json),
        gallery: parseStoredList(gallery_json),
      },
    });
  } catch (error) {
    console.error('Product lookup failed:', error?.message);
    return NextResponse.json({ error: 'Detail produk belum tersedia.' }, { status: 503 });
  }
}

export async function PATCH(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const { slug } = await params;
  try {
    const input = await request.json();
    const fields = [
      ['name', 'name', (value) => String(value).trim().slice(0, 200)],
      ['slug', 'slug', (value) => String(value).trim().toLowerCase()],
      ['category', 'category', (value) => String(value).trim().slice(0, 120)],
      ['description', 'description', (value) => String(value).trim().slice(0, 10000)],
      ['longDescription', 'long_description', (value) => String(value || '').trim().slice(0, 20000)],
      ['harvestDuration', 'harvest_duration', (value) => String(value || '').trim().slice(0, 120)],
      ['highlights', 'highlights_json', (value) => JSON.stringify(Array.isArray(value) ? value : String(value || '').split('\n').map((item) => item.trim()).filter(Boolean))],
      ['gallery', 'gallery_json', (value) => JSON.stringify(Array.isArray(value) ? value : String(value || '').split('\n').map((item) => item.trim()).filter(Boolean))],
      ['price', 'price', (value) => Number(value)],
      ['stock', 'stock', (value) => Number(value)],
      ['satuan', 'satuan', (value) => String(value).trim().slice(0, 40)],
      ['origin', 'origin', (value) => String(value).trim().slice(0, 300)],
      ['imageUrl', 'image_url', (value) => String(value).trim().slice(0, 1000)],
      ['shippingWeightGram', 'shipping_weight_gram', (value) => value === '' || value == null ? null : Number(value)],
      ['shippingLengthCm', 'shipping_length_cm', (value) => value === '' || value == null ? null : Number(value)],
      ['shippingWidthCm', 'shipping_width_cm', (value) => value === '' || value == null ? null : Number(value)],
      ['shippingHeightCm', 'shipping_height_cm', (value) => value === '' || value == null ? null : Number(value)],
      ['isActive', 'is_active', (value) => Boolean(value)],
    ];
    const updates = fields.filter(([key]) => Object.hasOwn(input, key));
    if (!updates.length) return NextResponse.json({ error: 'Tidak ada perubahan.' }, { status: 400 });
    const values = updates.map(([key, , normalize]) => normalize(input[key]));
    if (updates.some(([key]) => key === 'stock')) {
      const { rows: currentProducts } = await query(
        `SELECT p.stock,
          EXISTS(SELECT 1 FROM warehouses) AS has_warehouses
         FROM products p WHERE p.slug=?`,
        [slug],
      );
      if (!currentProducts[0]) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
      if (currentProducts[0].has_warehouses) {
        return NextResponse.json({ error: 'Stok dikelola per gudang. Ubah stok melalui menu Gudang di portal suplier.' }, { status: 409 });
      }
    }
    for (const [index, [key]] of updates.entries()) {
      if (key === 'name' && values[index].length < 2) return NextResponse.json({ error: 'Nama produk tidak valid.' }, { status: 400 });
      if (key === 'slug' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values[index])) return NextResponse.json({ error: 'Slug tidak valid.' }, { status: 400 });
      if (key === 'price' && (!Number.isInteger(values[index]) || values[index] < 0)) return NextResponse.json({ error: 'Harga harus berupa bilangan Rupiah bulat.' }, { status: 400 });
      if (key === 'stock' && (!Number.isInteger(values[index]) || values[index] < 0)) return NextResponse.json({ error: 'Stok tidak valid.' }, { status: 400 });
      if (key === 'longDescription' && String(values[index]).length > 20000) return NextResponse.json({ error: 'Detail produk maksimal 20.000 karakter.' }, { status: 400 });
      if (key === 'harvestDuration' && String(values[index]).length > 120) return NextResponse.json({ error: 'Lama panen/produksi maksimal 120 karakter.' }, { status: 400 });
      if (key === 'highlights' || key === 'gallery') {
        const entries = JSON.parse(values[index]);
        if (entries.length > 12 || entries.some((entry) => typeof entry !== 'string' || entry.length > (key === 'gallery' ? 1000 : 300))) {
          return NextResponse.json({ error: key === 'gallery' ? 'Galeri maksimal 12 URL gambar.' : 'Poin produk maksimal 12 butir.' }, { status: 400 });
        }
        if (key === 'gallery' && entries.some((entry) => !isValidCloudinaryOrLocalUrl(entry))) {
          return NextResponse.json({ error: 'URL galeri harus berupa path lokal atau HTTP(S).' }, { status: 400 });
        }
      }
      if (key === 'satuan' && !values[index]) return NextResponse.json({ error: 'Satuan produk wajib diisi.' }, { status: 400 });
      if (key === 'imageUrl' && values[index] && !isValidCloudinaryOrLocalUrl(values[index])) return NextResponse.json({ error: 'URL gambar harus menggunakan HTTP(S) atau path lokal.' }, { status: 400 });
      if (key.startsWith('shipping') && values[index] !== null && (!Number.isSafeInteger(values[index]) || values[index] <= 0)) return NextResponse.json({ error: 'Berat gram dan dimensi cm harus bilangan bulat positif.' }, { status: 400 });
    }
    const packageFields = ['shippingWeightGram', 'shippingLengthCm', 'shippingWidthCm', 'shippingHeightCm'];
    const packageUpdates = updates.filter(([key]) => packageFields.includes(key));
    if (packageUpdates.length && packageUpdates.length !== packageFields.length) {
      return NextResponse.json({ error: 'Perubahan berat/dimensi harus mengirim keempat field.' }, { status: 400 });
    }
    if (packageUpdates.length && packageUpdates.some(([key], index) => values[updates.findIndex(([field]) => field === key)] === null) &&
        packageUpdates.some(([key], index) => values[updates.findIndex(([field]) => field === key)] !== null)) {
      return NextResponse.json({ error: 'Isi berat gram dan ketiga dimensi cm sekaligus, atau kosongkan semuanya.' }, { status: 400 });
    }

    const setClause = updates.map(([, column]) => `\`${column}\` = ?`).join(', ');
    await query(
      `UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE slug = ?`,
      [...values, slug],
    );
    const { rows } = await query(
      `SELECT id, slug, name, category, description, long_description, harvest_duration, highlights_json, gallery_json,
              price, stock, satuan, origin, image_url, is_active, shipping_weight_gram,
              shipping_length_cm, shipping_width_cm, shipping_height_cm
       FROM products WHERE slug = ?`,
      [updates.some(([key]) => key === 'slug') ? values[updates.findIndex(([key]) => key === 'slug')] : slug],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    const { highlights_json, gallery_json, ...product } = rows[0];
    return NextResponse.json({ product: { ...product, highlights: parseStoredList(highlights_json), gallery: parseStoredList(gallery_json) } });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Slug sudah digunakan.' }, { status: 409 });
    console.error('Product update failed:', error?.message);
    return NextResponse.json({ error: 'Produk belum dapat diperbarui.' }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const { slug } = await params;
  try {
    const { rowCount } = await query(
      'UPDATE products SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE slug = ?',
      [slug],
    );
    if (!rowCount) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ ok: true, product: { slug } });
  } catch (error) {
    console.error('Product deactivation failed:', error?.message);
    return NextResponse.json({ error: 'Produk belum dapat dinonaktifkan.' }, { status: 500 });
  }
}
