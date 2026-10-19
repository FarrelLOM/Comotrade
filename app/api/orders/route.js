import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const admin = user.role === 'admin';
    const { rows } = await query(
      `SELECT o.id, o.user_id, o.status, o.subtotal, o.shipping_cost, o.total,
              o.shipping_address, o.customer_note, o.created_at,
              u.full_name AS customer_name,
              COALESCE(json_agg(json_build_object(
                'id', oi.id, 'product_id', oi.product_id, 'name', oi.product_name,
                'unit_price', oi.unit_price, 'quantity', oi.quantity, 'line_total', oi.line_total
              )) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items,
              json_build_object('carrier', s.carrier, 'tracking_number', s.tracking_number, 'tracking_url', s.tracking_url) AS shipment,
              p.status AS payment_status
       FROM orders o JOIN users u ON u.id = o.user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN shipments s ON s.order_id = o.id
       LEFT JOIN payments p ON p.order_id = o.id
       ${admin ? '' : 'WHERE o.user_id = $1'}
       GROUP BY o.id, u.full_name, s.id, p.id ORDER BY o.created_at DESC LIMIT 200`,
      admin ? [] : [user.id],
    );
    return NextResponse.json({ orders: rows });
  } catch (error) {
    console.error('Order listing failed:', error?.message);
    return NextResponse.json({ error: 'Pesanan belum tersedia.' }, { status: 503 });
  }
}

export async function POST(request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const input = await request.json();
    const shippingAddress = String(input.shippingAddress || '').trim();
    const customerNote = String(input.customerNote || '').trim();
    const items = Array.isArray(input.items) ? input.items : [];
    if (shippingAddress.length < 8 || shippingAddress.length > 1000 || items.length < 1 || items.length > 50) {
      return NextResponse.json({ error: 'Alamat atau daftar produk tidak valid.' }, { status: 400 });
    }
    const quantities = new Map();
    for (const item of items) {
      const id = String(item.productId || '');
      const quantity = Number(item.quantity);
      if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return NextResponse.json({ error: 'Produk atau jumlah tidak valid.' }, { status: 400 });
      }
      quantities.set(id, (quantities.get(id) || 0) + quantity);
    }

    const order = await withTransaction(async (client) => {
      const ids = [...quantities.keys()].sort();
      const { rows: products } = await client.query(
        'SELECT id, name, price, stock FROM products WHERE id = ANY($1::uuid[]) AND is_active = true ORDER BY id FOR UPDATE',
        [ids],
      );
      if (products.length !== ids.length) throw Object.assign(new Error('Produk tidak ditemukan.'), { status: 400 });
      let subtotalCents = 0;
      for (const product of products) {
        const quantity = quantities.get(product.id);
        if (product.stock < quantity) throw Object.assign(new Error(`Stok ${product.name} tidak mencukupi.`), { status: 409 });
        subtotalCents += Math.round(Number(product.price) * 100) * quantity;
      }
      const subtotal = (subtotalCents / 100).toFixed(2);
      const { rows: created } = await client.query(
        `INSERT INTO orders (user_id, subtotal, total, shipping_address, customer_note)
         VALUES ($1,$2,$2,$3,$4) RETURNING id, total`,
        [user.id, subtotal, shippingAddress, customerNote.slice(0, 1000)],
      );
      for (const product of products) {
        const quantity = quantities.get(product.id);
        const unitPrice = Number(product.price);
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [created[0].id, product.id, product.name, unitPrice, quantity, (unitPrice * quantity).toFixed(2)],
        );
        await client.query('UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2', [quantity, product.id]);
      }
      await client.query(
        'INSERT INTO payments (order_id, amount, provider) VALUES ($1,$2,$3)',
        [created[0].id, created[0].total, process.env.PAYMENT_PROVIDER || 'manual'],
      );
      return created[0];
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Order creation failed:', error?.message);
    return NextResponse.json({ error: error?.message || 'Pesanan belum dapat dibuat.' }, { status: error?.status || 500 });
  }
}
