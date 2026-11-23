import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { getAvailableShippingWarehouses, getShippingQuotes, loadShippingProducts, parseProductIds } from '@/lib/jubelio-shipping';
import { buildShippingPackage, computeBuyerShipping, filterCargoQuotes } from '@/lib/jubelio-core.mjs';

export const runtime = 'nodejs';

function parseItems(items) {
  return typeof items === 'string' ? JSON.parse(items) : items || [];
}

function parseCoordinate(value) {
  if (value == null || value === '') return null;
  const parts = String(value).split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part)) || Math.abs(parts[0]) > 90 || Math.abs(parts[1]) > 180) return null;
  return `${parts[0]},${parts[1]}`;
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
              JSON_OBJECT(
                'carrier', COALESCE(js.courier_name, s.carrier),
                'tracking_number', COALESCE(js.awb, s.tracking_number),
                'tracking_url', COALESCE(js.tracking_url, s.tracking_url),
                'state', js.state, 'jubelio_status', js.jubelio_status,
                'attempt_id', js.id, 'carrier_price', js.carrier_price, 'price_drift', js.price_drift
              ) AS shipment,
              p.status AS payment_status, p.payment_url, p.payment_method, p.payment_code, p.expires_at,
              w.name AS warehouse_name
       FROM orders o JOIN users u ON u.id = o.user_id
       LEFT JOIN warehouses w ON w.id = o.warehouse_id
       LEFT JOIN shipments s ON s.order_id = o.id
       LEFT JOIN jubelio_shipment_attempts js ON js.id = (
         SELECT ja.id FROM jubelio_shipment_attempts ja WHERE ja.order_id = o.id ORDER BY ja.attempt_no DESC LIMIT 1
       )
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
    const customerNote = String(input.customerNote || '').trim();
    const quantities = parseProductIds(input.items);
    const addressId = String(input.addressId || '');
    const courierId = Number(input.courierId);
    const serviceId = Number(input.serviceId);
    const requestedWarehouseId = input.warehouseId == null || input.warehouseId === '' ? null : String(input.warehouseId);
    const expectedCarrierPrice = Number(input.expectedCarrierPrice);
    const withInsurance = Boolean(input.withInsurance);
    const suppliedCoordinate = input.destination?.coordinate;
    const parsedCoordinate = parseCoordinate(suppliedCoordinate);
    if (suppliedCoordinate && !parsedCoordinate) return NextResponse.json({ error: 'Titik peta tidak valid.' }, { status: 400 });
    if (!/^[0-9a-f-]{36}$/i.test(addressId) || !Number.isSafeInteger(courierId) || !Number.isSafeInteger(serviceId) || !Number.isSafeInteger(expectedCarrierPrice)) {
      return NextResponse.json({ error: 'Alamat atau pilihan kurir tidak valid. Hitung ulang ongkir.' }, { status: 400 });
    }

    const { rows: addressRows } = await query(
      'SELECT * FROM user_addresses WHERE id = ? AND user_id = ?',
      [addressId, user.id],
    );
    const address = addressRows[0];
    if (!address) return NextResponse.json({ error: 'Alamat pengiriman tidak ditemukan.' }, { status: 404 });

    const destination = {
      areaId: String(input.destination?.areaId || address.area_id).trim(),
      zipcode: String(input.destination?.zipcode || address.zipcode).trim(),
      coordinate: parsedCoordinate || address.coordinate,
      areaName: String(input.destination?.areaName || address.area_name).trim().slice(0, 200),
      districtName: String(input.destination?.districtName || address.district_name).trim().slice(0, 200),
      cityName: String(input.destination?.cityName || address.city_name).trim().slice(0, 200),
      provinceName: String(input.destination?.provinceName || address.province_name).trim().slice(0, 200),
    };
    const recipientName = String(input.recipientName || address.recipient_name).trim();
    const recipientPhone = String(input.recipientPhone || address.recipient_phone).trim();
    const addressLine = String(input.addressLine || address.address_line).trim();
    if (!/^\d{10}$/.test(destination.areaId) || !/^\d{4,10}$/.test(destination.zipcode) ||
        recipientName.length < 2 || recipientName.length > 120 || recipientPhone.length < 6 || recipientPhone.length > 30 ||
        addressLine.length < 8 || addressLine.length > 1000 || customerNote.length > 1000) {
      return NextResponse.json({ error: 'Informasi penerima, alamat, atau wilayah pengiriman tidak valid.' }, { status: 400 });
    }

    const products = await loadShippingProducts(quantities);
    for (const product of products) {
      if (product.stock < product.quantity) {
        return NextResponse.json({ error: `Stok ${product.name} tidak mencukupi.` }, { status: 409 });
      }
    }
    const availableWarehouses = await getAvailableShippingWarehouses(products);
    const warehouse = availableWarehouses.find((entry) => entry.id === requestedWarehouseId) ||
      (!requestedWarehouseId && availableWarehouses.length === 1 ? availableWarehouses[0] : null);
    if (!warehouse) {
      return NextResponse.json({ error: 'Gudang pilihan tidak lagi memiliki stok lengkap. Pilih ulang layanan pengiriman.' }, { status: 409 });
    }
    const quoteResult = await getShippingQuotes({
      products,
      destination,
      origin: warehouse.origin,
    });
    const totalQuantity = [...quantities.values()].reduce((sum, quantity) => sum + quantity, 0);
    const availableQuotes = filterCargoQuotes(quoteResult.quotes, totalQuantity);
    const quote = availableQuotes.find((item) =>
      String(item.courierId) === String(courierId) && String(item.serviceId) === String(serviceId) &&
      String(item.warehouseId || '') === String(warehouse.id || ''));
    if (!quote) return NextResponse.json({ error: 'Layanan kurir sudah tidak tersedia. Hitung ulang ongkir.' }, { status: 409 });
    if (quote.price !== expectedCarrierPrice) {
      return NextResponse.json({ error: 'Tarif berubah sejak konfirmasi. Pilih ulang layanan kurir.' }, { status: 409 });
    }
    const shipping = computeBuyerShipping(quote, {
      subtotal: quoteResult.package.totalValue,
      minSubtotal: Number(process.env.FREE_SHIPPING_MIN_SUBTOTAL) || 200000,
      maxSubsidy: Number(process.env.FREE_SHIPPING_MAX_SUBSIDY) || 20000,
      withInsurance,
    });
    const subtotalRupiah = quoteResult.package.totalValue;
    const totalRupiah = subtotalRupiah + shipping.buyerPays;
    if (!Number.isSafeInteger(totalRupiah)) throw new Error('Total pesanan melebihi batas yang didukung.');

    const order = await withTransaction(async (client) => {
      const lockedProducts = await loadShippingProducts(quantities, client, { forUpdate: true });
      const lockedPackage = buildShippingPackage(lockedProducts, Number(process.env.VOLUMETRIC_DIVISOR) || 6000);
      if (JSON.stringify(lockedPackage.packageDetail) !== JSON.stringify(quoteResult.package.packageDetail) || lockedPackage.totalValue !== quoteResult.package.totalValue) {
        throw Object.assign(new Error('Data produk berubah saat checkout. Hitung ulang tarif.'), { status: 409 });
      }
      for (const product of lockedProducts) {
        if (product.stock < product.quantity) throw Object.assign(new Error(`Stok ${product.name} tidak mencukupi.`), { status: 409 });
      }
      if (warehouse.id) {
        const { rows: lockedWarehouse } = await client.query(
          'SELECT id FROM warehouses WHERE id=? AND is_active=TRUE FOR UPDATE',
          [warehouse.id],
        );
        if (!lockedWarehouse[0]) throw Object.assign(new Error('Gudang pilihan sudah tidak aktif. Hitung ulang tarif.'), { status: 409 });
        const productIds = lockedProducts.map((product) => product.id).sort();
        const { rows: warehouseStocks } = await client.query(
          `SELECT product_id,stock FROM warehouse_inventory
           WHERE warehouse_id=? AND product_id IN (${productIds.map(() => '?').join(',')})
           ORDER BY product_id FOR UPDATE`,
          [warehouse.id, ...productIds],
        );
        const stockByProduct = new Map(warehouseStocks.map((row) => [String(row.product_id), Number(row.stock)]));
        for (const product of lockedProducts) {
          if ((stockByProduct.get(String(product.id)) || 0) < product.quantity) {
            throw Object.assign(new Error(`Stok ${product.name} di gudang ${warehouse.name} tidak mencukupi.`), { status: 409 });
          }
        }
      }
      const { rows: lockedAddresses } = await client.query(
        'SELECT * FROM user_addresses WHERE id = ? AND user_id = ? FOR UPDATE',
        [addressId, user.id],
      );
      const lockedAddress = lockedAddresses[0];
      if (!lockedAddress || ['recipient_name','recipient_phone','address_line','area_name','district_name','city_name','province_name','area_id','zipcode','coordinate']
        .some((field) => String(lockedAddress[field] || '') !== String(address[field] || ''))) {
        throw Object.assign(new Error('Alamat berubah saat checkout. Hitung ulang ongkir.'), { status: 409 });
      }

      const orderId = randomUUID();
      const merchantRef = `COMO-${randomUUID()}`;
      const subtotal = subtotalRupiah.toFixed(2);
      const shippingCost = shipping.buyerPays.toFixed(2);
      const total = totalRupiah.toFixed(2);
      const shippingAddress = [addressLine, destination.areaName, destination.districtName, destination.cityName, destination.provinceName, destination.zipcode]
        .filter(Boolean).join(', ').slice(0, 1000);
      const quoteSnapshot = JSON.stringify({
        packageDetail: quoteResult.package.packageDetail,
        totalWeightGram: quoteResult.package.totalWeightGram,
        volumetricWeightGram: quoteResult.package.volumetricWeightGram,
        origin: quoteResult.origin,
        selectedQuote: quote,
        shipping,
        destination,
      });
      await client.query(
        `INSERT INTO orders (
           id, user_id, subtotal, shipping_cost, total, shipping_address, customer_note,
           recipient_name, recipient_phone, shipping_area_id, shipping_zipcode, shipping_coordinate,
           selected_courier_id, selected_service_id, selected_courier_name, selected_service_name,
           selected_service_category, carrier_shipping_cost, shipping_subsidy, shipping_insurance,
           shipping_cod_fee, shipping_quote_json, warehouse_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId, user.id, subtotal, shippingCost, total, shippingAddress, customerNote.slice(0, 1000),
          recipientName, recipientPhone, destination.areaId, destination.zipcode, destination.coordinate,
          courierId, serviceId, quote.courierName, quote.serviceName, quote.category,
          shipping.carrierPrice.toFixed(2), shipping.subsidy.toFixed(2),
          shipping.insurance.toFixed(2), shipping.codFee.toFixed(2), quoteSnapshot, warehouse.id,
        ],
      );
      for (const product of lockedProducts) {
        const quantity = product.quantity;
        const unitPrice = Number(product.price);
        await client.query(
          `INSERT INTO order_items (
             id, order_id, product_id, product_name, satuan, unit_price, quantity, line_total,
             shipping_weight_gram, shipping_length_cm, shipping_width_cm, shipping_height_cm
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(), orderId, product.id, product.name, product.satuan || 'unit', unitPrice,
            quantity, (unitPrice * quantity).toFixed(2), product.shipping_weight_gram,
            product.shipping_length_cm, product.shipping_width_cm, product.shipping_height_cm,
          ],
        );
        await client.query(
          'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [quantity, product.id],
        );
        if (warehouse.id) {
          const { rowCount } = await client.query(
            `UPDATE warehouse_inventory SET stock=stock-?,updated_at=CURRENT_TIMESTAMP
             WHERE warehouse_id=? AND product_id=? AND stock>=?`,
            [quantity, warehouse.id, product.id, quantity],
          );
          if (rowCount !== 1) throw Object.assign(new Error(`Stok ${product.name} berubah selama checkout. Hitung ulang tarif.`), { status: 409 });
        }
      }
      await client.query(
        `INSERT INTO payments (id, order_id, provider, merchant_ref, amount)
         VALUES (?, ?, 'tripay', ?, ?)`,
        [randomUUID(), orderId, merchantRef, total],
      );
      return {
        id: orderId,
        subtotal,
        shipping_cost: shippingCost,
        total,
        merchant_ref: merchantRef,
        warehouse_id: warehouse.id,
        warehouse_name: warehouse.name,
        courier: { name: quote.courierName, service: quote.serviceName, carrierPrice: shipping.carrierPrice },
      };
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Order creation failed:', error?.code || error?.message);
    const status = error?.code?.startsWith('JUBELIO_') ? 503 : error?.status || 500;
    const message = error?.code?.startsWith('JUBELIO_')
      ? 'Tarif pengiriman sementara tidak tersedia.'
      : error?.message || 'Pesanan belum dapat dibuat.';
    return NextResponse.json({ error: message }, { status });
  }
}
