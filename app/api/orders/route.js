import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';

export const runtime = 'nodejs';

function parseItems(items) {
  return typeof items === 'string' ? JSON.parse(items) : items || [];
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const isAdmin = user.role === 'admin';
    const { rows } = await query(
      `SELECT o.id, o.user_id, o.status, o.subtotal, o.shipping_cost, o.total,
              o.shipping_address, o.customer_note, o.created_at, u.full_name AS customer_name,
              COALESCE((
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                  'id', oi.id, 'product_id', oi.product_id, 'name', oi.product_name,
                  'satuan', oi.satuan, 'unit_price', oi.unit_price, 'quantity', oi.quantity, 'line_total', oi.line_total
                ))
                FROM order_items oi WHERE oi.order_id = o.id
              ), JSON_ARRAY()) AS items,
              JSON_OBJECT('carrier', s.carrier, 'tracking_number', s.tracking_number, 'tracking_url', s.tracking_url) AS shipment,
              p.status AS payment_status, p.payment_url, p.payment_method, p.payment_code, p.expires_at
       FROM orders o JOIN users u ON u.id = o.user_id
       LEFT JOIN shipments s ON s.order_id = o.id
       LEFT JOIN payments p ON p.order_id = o.id
       ${isAdmin ? '' : 'WHERE o.user_id = ?'}
       ORDER BY o.created_at DESC LIMIT 200`,
      isAdmin ? [] : [user.id],
    );
    return NextResponse.json({
      orders: rows.map((order) => ({ ...order, items: parseItems(order.items) })),
    });
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
      if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
        return NextResponse.json({ error: 'Produk atau jumlah tidak valid.' }, { status: 400 });
      }
      quantities.set(id, (quantities.get(id) || 0) + quantity);
    }

    const order = await withTransaction(async (client) => {
      const ids = [...quantities.keys()].sort();
      const placeholders = ids.map(() => '?').join(', ');
      const { rows: products } = await client.query(
        `SELECT id, name, price, stock, satuan FROM products
         WHERE id IN (${placeholders}) AND is_active = TRUE ORDER BY id FOR UPDATE`,
        ids,
      );
      if (products.length !== ids.length) throw Object.assign(new Error('Produk tidak ditemukan.'), { status: 400 });

      let subtotalCents = 0;
      for (const product of products) {
        const quantity = quantities.get(product.id);
        if (product.stock < quantity) throw Object.assign(new Error(`Stok ${product.name} tidak mencukupi.`), { status: 409 });
        subtotalCents += Math.round(Number(product.price) * 100) * quantity;
      }

      const orderId = randomUUID();
      const merchantRef = `COMO-${randomUUID()}`;
      const subtotal = (subtotalCents / 100).toFixed(2);
      await client.query(
        `INSERT INTO orders (id, user_id, subtotal, total, shipping_address, customer_note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, user.id, subtotal, subtotal, shippingAddress, customerNote.slice(0, 1000)],
      );
      for (const product of products) {
        const quantity = quantities.get(product.id);
        const unitPrice = Number(product.price);
        await client.query(
          `INSERT INTO order_items (id, order_id, product_id, product_name, satuan, unit_price, quantity, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), orderId, product.id, product.name, product.satuan || 'unit', unitPrice, quantity, (unitPrice * quantity).toFixed(2)],
        );
        await client.query(
          'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [quantity, product.id],
        );
      }
      await client.query(
        `INSERT INTO payments (id, order_id, provider, merchant_ref, amount)
         VALUES (?, ?, 'tripay', ?, ?)`,
        [randomUUID(), orderId, merchantRef, subtotal],
      );
      return { id: orderId, total: subtotal, merchant_ref: merchantRef };
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Order creation failed:', error?.message);
    return NextResponse.json({ error: error?.message || 'Pesanan belum dapat dibuat.' }, { status: error?.status || 500 });
  }
}
