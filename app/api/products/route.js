import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { rows } = await query(
      `SELECT id, slug, name, category, description, price, stock, satuan, origin, image_url, created_at
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
    const origin = String(input.origin || '').trim();
    const imageUrl = String(input.imageUrl || '').trim();
    const price = Number(input.price);
    const stock = Number(input.stock);
    const satuan = String(input.satuan || 'unit').trim();
    if (name.length < 2 || name.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ error: 'Nama atau slug produk tidak valid.' }, { status: 400 });
    }
    if (!Number.isInteger(price) || price < 0 || !Number.isInteger(stock) || stock < 0 || description.length > 10000 || !satuan || satuan.length > 40) {
      return NextResponse.json({ error: 'Harga, stok, atau deskripsi tidak valid.' }, { status: 400 });
    }
    if (imageUrl && !imageUrl.startsWith('/') && !/^https?:\/\//i.test(imageUrl)) {
      return NextResponse.json({ error: 'URL gambar harus berupa path lokal atau HTTP(S).' }, { status: 400 });
    }

    const id = randomUUID();
    await query(
      `INSERT INTO products (id, slug, name, category, description, price, stock, satuan, origin, image_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, slug, name, category.slice(0, 120), description, price, stock, satuan, origin.slice(0, 300), imageUrl.slice(0, 1000), admin.id],
    );
    const { rows } = await query(
      `SELECT id, slug, name, category, description, price, stock, satuan, origin, image_url
       FROM products WHERE id = ?`,
      [id],
    );
    return NextResponse.json({ product: rows[0] }, { status: 201 });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Slug sudah digunakan.' }, { status: 409 });
    console.error('Product creation failed:', error?.message);
    return NextResponse.json({ error: 'Produk belum dapat disimpan.' }, { status: 500 });
  }
}
