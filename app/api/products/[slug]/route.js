import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  try {
    const { slug } = await params;
    const { rows } = await query(
      `SELECT id, slug, name, category, description, price, stock, origin, image_url
       FROM products WHERE slug = $1 AND is_active = true`,
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
      ['origin', 'origin', (value) => String(value).trim().slice(0, 300)],
      ['imageUrl', 'image_url', (value) => String(value).trim().slice(0, 1000)],
      ['isActive', 'is_active', (value) => Boolean(value)],
    ];
    const updates = fields.filter(([key]) => Object.hasOwn(input, key));
    if (!updates.length) return NextResponse.json({ error: 'Tidak ada perubahan.' }, { status: 400 });
    const values = updates.map(([key, , normalize]) => normalize(input[key]));
    for (const [index, [key]] of updates.entries()) {
      if (key === 'slug' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values[index])) return NextResponse.json({ error: 'Slug tidak valid.' }, { status: 400 });
      if (key === 'price' && (!Number.isFinite(values[index]) || values[index] < 0)) return NextResponse.json({ error: 'Harga tidak valid.' }, { status: 400 });
      if (key === 'stock' && (!Number.isInteger(values[index]) || values[index] < 0)) return NextResponse.json({ error: 'Stok tidak valid.' }, { status: 400 });
      if (key === 'imageUrl' && values[index] && !values[index].startsWith('/') && !/^https?:\/\//i.test(values[index])) return NextResponse.json({ error: 'URL gambar harus berupa path lokal atau HTTP(S).' }, { status: 400 });
    }
    values.push(slug);
    const setClause = updates.map(([, column], index) => `${column}=$${index + 1}`).join(', ');
    const { rows } = await query(
      `UPDATE products SET ${setClause},updated_at=now() WHERE slug=$${values.length}
       RETURNING id,slug,name,category,description,price,stock,origin,image_url,is_active`,
      values,
    );
    if (!rows[0]) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ product: rows[0] });
  } catch (error) {
    if (error?.code === '23505') return NextResponse.json({ error: 'Slug sudah digunakan.' }, { status: 409 });
    console.error('Product update failed:', error?.message);
    return NextResponse.json({ error: 'Produk belum dapat diperbarui.' }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const { slug } = await params;
  try {
    const { rows } = await query(
      'UPDATE products SET is_active=false,updated_at=now() WHERE slug=$1 RETURNING id,slug',
      [slug],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ ok: true, product: rows[0] });
  } catch (error) {
    console.error('Product deactivation failed:', error?.message);
    return NextResponse.json({ error: 'Produk belum dapat dinonaktifkan.' }, { status: 500 });
  }
}
