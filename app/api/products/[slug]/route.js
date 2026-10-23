import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  try {
    const { slug } = await params;
    const { rows } = await query(
      `SELECT id, slug, name, category, description, price, stock, satuan, origin, image_url
       FROM products WHERE slug = ? AND is_active = TRUE`,
      [slug],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ product: rows[0] });
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
      ['price', 'price', (value) => Number(value)],
      ['stock', 'stock', (value) => Number(value)],
      ['satuan', 'satuan', (value) => String(value).trim().slice(0, 40)],
      ['origin', 'origin', (value) => String(value).trim().slice(0, 300)],
      ['imageUrl', 'image_url', (value) => String(value).trim().slice(0, 1000)],
      ['isActive', 'is_active', (value) => Boolean(value)],
    ];
    const updates = fields.filter(([key]) => Object.hasOwn(input, key));
    if (!updates.length) return NextResponse.json({ error: 'Tidak ada perubahan.' }, { status: 400 });
    const values = updates.map(([key, , normalize]) => normalize(input[key]));
    for (const [index, [key]] of updates.entries()) {
      if (key === 'name' && values[index].length < 2) return NextResponse.json({ error: 'Nama produk tidak valid.' }, { status: 400 });
      if (key === 'slug' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values[index])) return NextResponse.json({ error: 'Slug tidak valid.' }, { status: 400 });
      if (key === 'price' && (!Number.isInteger(values[index]) || values[index] < 0)) return NextResponse.json({ error: 'Harga harus berupa bilangan Rupiah bulat.' }, { status: 400 });
      if (key === 'stock' && (!Number.isInteger(values[index]) || values[index] < 0)) return NextResponse.json({ error: 'Stok tidak valid.' }, { status: 400 });
      if (key === 'satuan' && !values[index]) return NextResponse.json({ error: 'Satuan produk wajib diisi.' }, { status: 400 });
      if (key === 'imageUrl' && values[index] && !values[index].startsWith('/') && !/^https?:\/\//i.test(values[index])) return NextResponse.json({ error: 'URL gambar harus menggunakan HTTP(S) atau path lokal.' }, { status: 400 });
    }

    const setClause = updates.map(([, column]) => `\`${column}\` = ?`).join(', ');
    await query(
      `UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE slug = ?`,
      [...values, slug],
    );
    const { rows } = await query(
      `SELECT id, slug, name, category, description, price, stock, satuan, origin, image_url, is_active
       FROM products WHERE slug = ?`,
      [updates.some(([key]) => key === 'slug') ? values[updates.findIndex(([key]) => key === 'slug')] : slug],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ product: rows[0] });
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
