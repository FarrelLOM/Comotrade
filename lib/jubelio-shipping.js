import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { query, withTransaction } from './db';
import { getJubelioClient, JubelioError } from './jubelio-client';
import { buildShippingPackage, computeBuyerShipping, normalizeJubelioRates } from './jubelio-core.mjs';

const STATUS = new Set([
  'WAITING', 'CONFIRMED_BY_COURIER', 'ON_THE_WAY_PICK_UP', 'PICKED_UP',
  'ON_DELIVERY', 'ON_HOLD', 'DELIVERED', 'RETURNED', 'CANCELED', 'SHIPMENT_ISSUE',
]);
const TERMINAL = new Set(['DELIVERED', 'RETURNED', 'CANCELED']);
const CANCELABLE = new Set(['WAITING', 'CONFIRMED_BY_COURIER', 'ON_THE_WAY_PICK_UP']);

const idsIn = (ids) => ids.map(() => '?').join(',');
const productFields = 'id, name, price, stock, shipping_weight_gram, shipping_length_cm, shipping_width_cm, shipping_height_cm';
const requestError = (message, status = 400) => Object.assign(new Error(message), { status });

export function parseProductIds(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw requestError('Daftar produk tidak valid.');
  const quantities = new Map();
  for (const item of items) {
    const id = String(item?.productId || '');
    const quantity = Number(item?.quantity);
    if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
      throw requestError('Produk atau jumlah tidak valid.');
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }
  return quantities;
}

export async function loadShippingProducts(quantities, executor = { query }, { forUpdate = false } = {}) {
  const ids = [...quantities.keys()].sort();
  if (!ids.length) throw requestError('Keranjang pengiriman tidak boleh kosong.');
  const { rows } = await executor.query(
    `SELECT ${productFields} FROM products WHERE is_active = TRUE AND id IN (${idsIn(ids)}) ORDER BY id${forUpdate ? ' FOR UPDATE' : ''}`,
    ids,
  );
  if (rows.length !== ids.length) throw requestError('Satu atau beberapa produk tidak tersedia.', 404);
  return rows.map((row) => ({ ...row, quantity: quantities.get(row.id), price: Number(row.price) }));
}

function warehouseFromEnv(env = process.env) {
  const required = ['WAREHOUSE_NAME', 'WAREHOUSE_PHONE', 'WAREHOUSE_ADDRESS', 'WAREHOUSE_ZIPCODE'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw requestError(`Data gudang belum lengkap: ${missing.join(', ')}`, 503);
  return {
    name: env.WAREHOUSE_NAME,
    email: env.WAREHOUSE_EMAIL || undefined,
    phone: env.WAREHOUSE_PHONE,
    address: env.WAREHOUSE_ADDRESS,
    area_id: env.WAREHOUSE_AREA_ID || undefined,
    zipcode: env.WAREHOUSE_ZIPCODE,
    coordinate: env.WAREHOUSE_COORDINATE || undefined,
  };
}

function warehouseOrigin(row) {
  return {
    name: row.name,
    email: row.email || undefined,
    phone: row.phone,
    address: row.address_line,
    area_id: row.area_id || undefined,
    zipcode: row.zipcode,
    coordinate: row.coordinate || undefined,
  };
}

export async function getAvailableShippingWarehouses(products, executor = { query }, env = process.env) {
  const quantities = new Map(products.map((product) => [String(product.id), Number(product.quantity)]));
  const ids = [...quantities.keys()].sort();
  if (!ids.length) return [];
  const { rows } = await executor.query(
    `SELECT w.id,w.name,w.phone,w.email,w.address_line,w.area_id,w.zipcode,w.coordinate,
            w.is_default,w.is_active,wi.product_id,wi.stock
     FROM warehouses w
     LEFT JOIN warehouse_inventory wi ON wi.warehouse_id=w.id AND wi.product_id IN (${idsIn(ids)})
     ORDER BY w.is_active DESC,w.is_default DESC,w.name,wi.product_id`,
    ids,
  );
  if (!rows.length) {
    const origin = warehouseFromEnv(env);
    return [{ id: null, name: origin.name, origin, legacy: true }];
  }

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.id)) grouped.set(row.id, { id: row.id, name: row.name, origin: warehouseOrigin(row), active: Boolean(row.is_active), stocks: new Map() });
    if (row.product_id) grouped.get(row.id).stocks.set(String(row.product_id), Number(row.stock));
  }
  return [...grouped.values()].filter((warehouse) =>
    warehouse.active && [...quantities].every(([productId, quantity]) => (warehouse.stocks.get(productId) || 0) >= quantity),
  );
}

export function ratesPayload({ destination, package: pkg, origin = warehouseFromEnv() }) {
  if (!destination?.zipcode || !destination?.areaId) throw requestError('Pilih wilayah tujuan yang memiliki area_id dan kode pos.');
  return {
    origin: {
      area_id: origin.area_id,
      zipcode: origin.zipcode,
      coordinate: origin.coordinate,
    },
    destination: {
      area_id: destination.areaId,
      zipcode: destination.zipcode,
      coordinate: destination.coordinate || undefined,
    },
    package_detail: pkg.packageDetail,
    weight: pkg.totalWeightGram,
    total_value: pkg.totalValue,
  };
}

export async function getShippingQuotes({ products, destination, cod = false, serviceCategoryId, origin: suppliedOrigin, client = getJubelioClient(), env = process.env }) {
  const pkg = buildShippingPackage(products, Number(env.VOLUMETRIC_DIVISOR) || 6000);
  const origin = suppliedOrigin || warehouseFromEnv(env);
  const payload = ratesPayload({ destination, package: pkg, origin });
  const rawRates = serviceCategoryId
    ? await client.getRatesByCategory({ ...payload, service_category_id: serviceCategoryId })
    : await client.getRates(payload);
  const quotes = normalizeJubelioRates(rawRates, { cod });
  const minSubtotal = Number(env.FREE_SHIPPING_MIN_SUBTOTAL) || 200000;
  const maxSubsidy = Number(env.FREE_SHIPPING_MAX_SUBSIDY) || 20000;
  return {
    package: pkg,
    origin,
    quotes: quotes.map((quote) => ({
      ...quote,
      buyer: computeBuyerShipping(quote, {
        subtotal: pkg.totalValue,
        minSubtotal,
        maxSubsidy,
        withInsurance: false,
        cod,
      }),
    })),
  };
}

export async function searchShippingRegions(name, client = getJubelioClient()) {
  const term = String(name || '').trim();
  if (term.length < 3 || term.length > 100) throw requestError('Cari wilayah dengan minimal 3 karakter.');
  return client.getRegions(term);
}

export async function applyStatusUpdate({ awb, latestStatus, tracking, extras = {}, source = 'webhook' }) {
  if (!STATUS.has(latestStatus)) return { applied: false, reason: 'UNKNOWN_STATUS' };
  const incomingEntries = (Array.isArray(tracking) ? tracking : tracking ? [tracking] : [])
    .filter((entry) => entry?.status && entry?.date && Number.isFinite(Date.parse(entry.date)))
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
  const latestEntry = incomingEntries.at(-1);
  const incomingAt = latestEntry ? new Date(latestEntry.date) : new Date();

  return withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `SELECT s.id, s.order_id, s.state, s.jubelio_status, s.last_event_at, o.status AS order_status
       FROM jubelio_shipment_attempts s JOIN orders o ON o.id = s.order_id
       WHERE s.awb = ? ORDER BY s.attempt_no DESC LIMIT 1 FOR UPDATE`,
      [String(awb || '')],
    );
    const attempt = rows[0];
    if (!attempt) return { applied: false, reason: 'UNKNOWN_AWB' };

    for (const entry of incomingEntries) {
      await tx.query(
        `INSERT IGNORE INTO jubelio_shipment_events (shipment_attempt_id, event_at, status_code, detail, source)
         VALUES (?, ?, ?, ?, ?)`,
        [attempt.id, new Date(entry.date), String(entry.status).slice(0, 80), String(entry.status_detail || '').slice(0, 1000), source],
      );
    }

    const currentAt = attempt.last_event_at ? new Date(attempt.last_event_at).getTime() : null;
    const isStale = currentAt !== null && incomingAt.getTime() < currentAt;
    const sameStatus = attempt.jubelio_status === latestStatus;
    const alreadyFinal = TERMINAL.has(attempt.jubelio_status);
    if (sameStatus || alreadyFinal || isStale) {
      await tx.query('UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [attempt.order_id]);
      return { applied: false, reason: sameStatus ? 'SAME_STATUS' : alreadyFinal ? 'ALREADY_TERMINAL' : 'STALE_EVENT' };
    }

    const state = latestStatus === 'CANCELED' ? 'CANCELED' : attempt.state;
    await tx.query(
      `UPDATE jubelio_shipment_attempts
       SET jubelio_status = ?, last_event_at = ?, state = ?, tracking_url = COALESCE(?, tracking_url),
           proof_json = COALESCE(?, proof_json), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        latestStatus,
        incomingAt,
        state,
        extras.trackingUrl || null,
        Object.keys(extras).length ? JSON.stringify(extras) : null,
        attempt.id,
      ],
    );

    const orderStatus = latestStatus === 'DELIVERED'
      ? 'delivered'
      : latestStatus === 'RETURNED'
        ? 'returned'
      : ['PICKED_UP', 'ON_DELIVERY'].includes(latestStatus)
        ? 'shipped'
        : 'processing';
    await tx.query('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [orderStatus, attempt.order_id]);
    return { applied: true, orderId: attempt.order_id, orderStatus, latestStatus };
  });
}

function refNoForOrder(orderId, env = process.env) {
  return env.JUBELIO_REF_NO_MODE === 'order' ? orderId : '[auto]';
}

function createPayload(order, items, env = process.env) {
  const origin = warehouseFromEnv(env);
  const destination = {
    name: order.recipient_name,
    phone: order.recipient_phone,
    address: order.shipping_address,
    area_id: order.shipping_area_id,
    zipcode: order.shipping_zipcode,
    coordinate: order.shipping_coordinate,
  };
  const quoteSnapshot = JSON.parse(typeof order.shipping_quote_json === 'string'
    ? order.shipping_quote_json
    : JSON.stringify(order.shipping_quote_json));
  return {
    ref_no: refNoForOrder(order.id, env),
    courier_id: order.selected_courier_id,
    courier_service_id: order.selected_service_id,
    shipping_insurance: Number(order.shipping_insurance) || 0,
    is_cod: false,
    origin: quoteSnapshot.origin || origin,
    destination,
    package_detail: quoteSnapshot.packageDetail,
    items: items.map((item) => ({
      item_code: item.product_id,
      item_name: item.product_name,
      category: item.category || '-',
      quantity: item.quantity,
      value: Number(item.unit_price),
      weight: item.shipping_weight_gram,
      length: item.shipping_length_cm,
      width: item.shipping_width_cm,
      height: item.shipping_height_cm,
    })),
  };
}

export async function createShipmentForOrder(orderId, { client = getJubelioClient(), env = process.env } = {}) {
  const attempt = await withTransaction(async (tx) => {
    const { rows: orderRows } = await tx.query(
      `SELECT o.*, p.status AS payment_status FROM orders o JOIN payments p ON p.order_id = o.id
       WHERE o.id = ? FOR UPDATE`,
      [orderId],
    );
    const order = orderRows[0];
    if (!order) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });
    if (order.payment_status !== 'paid' || ['cancelled', 'refunded'].includes(order.status)) {
      throw Object.assign(new Error('Resi hanya dapat dibuat untuk pesanan yang sudah dibayar.'), { status: 409 });
    }
    if (!order.selected_courier_id || !order.selected_service_id || !order.shipping_quote_json) {
      throw Object.assign(new Error('Pesanan lama belum memiliki snapshot tarif Jubelio; buat pesanan baru melalui checkout.'), { status: 409 });
    }
    const { rows: previousRows } = await tx.query(
      'SELECT attempt_no, state FROM jubelio_shipment_attempts WHERE order_id = ? ORDER BY attempt_no DESC LIMIT 1 FOR UPDATE',
      [orderId],
    );
    const previous = previousRows[0];
    if (previous && ['CREATING', 'CREATED', 'UNKNOWN'].includes(previous.state)) {
      throw Object.assign(new Error(`Sudah ada percobaan resi aktif (${previous.state}). Jangan buat resi ulang.`), { status: 409 });
    }
    const { rows: itemRows } = await tx.query(
      'SELECT product_id, product_name, unit_price, quantity, shipping_weight_gram, shipping_length_cm, shipping_width_cm, shipping_height_cm FROM order_items WHERE order_id = ? ORDER BY id',
      [orderId],
    );
    const id = randomUUID();
    const attemptNo = Number(previous?.attempt_no || 0) + 1;
    await tx.query(
      `INSERT INTO jubelio_shipment_attempts (id, order_id, attempt_no, state, courier_id, service_id, courier_name, service_name)
       VALUES (?, ?, ?, 'CREATING', ?, ?, ?, ?)`,
      [id, orderId, attemptNo, order.selected_courier_id, order.selected_service_id, order.selected_courier_name, order.selected_service_name],
    );
    return { id, order, items: itemRows };
  });

  let response;
  try {
    response = await client.createShipment(createPayload(attempt.order, attempt.items, env));
  } catch (error) {
    const unknown = Boolean(error?.outcomeUnknown);
    await query(
      `UPDATE jubelio_shipment_attempts SET state = ?, error_code = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [unknown ? 'UNKNOWN' : 'FAILED', error?.code || 'JUBELIO_ERROR', String(error?.message || 'Pembuatan resi gagal.').slice(0, 500), attempt.id],
    );
    throw error;
  }

  if (!response?.awb || !Number.isSafeInteger(Number(response.price))) {
    const error = new JubelioError('Respons pembuatan resi Jubelio tidak lengkap; periksa dashboard sebelum mencoba lagi.', {
      endpoint: 'POST /shipments/create', code: 'JUBELIO_INVALID_RESPONSE', outcomeUnknown: true,
    });
    await query(
      `UPDATE jubelio_shipment_attempts SET state = 'UNKNOWN', error_code = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [error.code, error.message, attempt.id],
    );
    throw error;
  }

  try {
    const price = Number(response.price);
    const drift = price - Number(attempt.order.carrier_shipping_cost);
    await query(
      `UPDATE jubelio_shipment_attempts SET state = 'CREATED', awb = ?, jubelio_shipment_id = ?,
       carrier_price = ?, price_drift = ?, tracking_url = ?, jubelio_status = 'WAITING',
       last_event_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [response.awb, response.shipment_id || null, price, drift, response.tracking_url || null, attempt.id],
    );
    const pendingEvents = await getPendingWebhookEvents(response.awb);
    for (const event of pendingEvents) await processJubelioWebhook(event.key, event.payload);
    return { attemptId: attempt.id, awb: response.awb, trackingUrl: response.tracking_url || null, price, priceDrift: drift };
  } catch (error) {
    // Respons sukses sudah diterima; kegagalan simpan lokal tetap UNKNOWN agar tidak menerbitkan AWB ganda.
    await query(
      `UPDATE jubelio_shipment_attempts SET state = 'UNKNOWN', error_code = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ['LOCAL_PERSISTENCE_AFTER_CREATE', String(error?.message || 'AWB berhasil dibuat tetapi penyimpanan lokal gagal.').slice(0, 500), attempt.id],
    ).catch(() => {});
    throw error;
  }
}

export async function cancelShipmentForOrder(orderId, reason = 'Dibatalkan oleh admin', { client = getJubelioClient() } = {}) {
  const { rows } = await query(
    `SELECT id, awb, state, jubelio_status FROM jubelio_shipment_attempts
     WHERE order_id = ? ORDER BY attempt_no DESC LIMIT 1`,
    [orderId],
  );
  const attempt = rows[0];
  if (!attempt || attempt.state !== 'CREATED' || !attempt.awb) {
    throw Object.assign(new Error('Tidak ada resi aktif untuk dibatalkan.'), { status: 409 });
  }
  if (!CANCELABLE.has(attempt.jubelio_status)) {
    throw Object.assign(new Error('Resi hanya dapat dibatalkan sebelum kurir menjemput barang.'), { status: 409 });
  }
  await client.cancelShipment({ awbCode: attempt.awb, reason: String(reason).slice(0, 300) });
  await query("UPDATE jubelio_shipment_attempts SET state = 'CANCELED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [attempt.id]);
  await applyStatusUpdate({ awb: attempt.awb, latestStatus: 'CANCELED', tracking: [], source: 'manual' });
  return { canceled: true, awb: attempt.awb };
}

export async function resolveUnknownShipment(orderId, { awb }, { client = getJubelioClient() } = {}) {
  const { rows } = await query(
    `SELECT id, awb, state, courier_id, service_id FROM jubelio_shipment_attempts
     WHERE order_id = ? ORDER BY attempt_no DESC LIMIT 1`,
    [orderId],
  );
  const attempt = rows[0];
  if (!attempt || !['UNKNOWN', 'CREATING'].includes(attempt.state)) {
    throw Object.assign(new Error('Percobaan resi tidak berstatus UNKNOWN/CREATING.'), { status: 409 });
  }
  if (!awb) {
    await query(
      `UPDATE jubelio_shipment_attempts SET state = 'FAILED', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ['Admin memverifikasi bahwa resi tidak terbit di Jubelio.', attempt.id],
    );
    return { resolved: true, state: 'FAILED' };
  }
  const detail = await client.getShipment(String(awb));
  if (detail?.awb !== String(awb)) throw Object.assign(new Error('AWB tidak cocok dengan detail Jubelio.'), { status: 400 });
  if ((detail.courier_id && Number(detail.courier_id) !== Number(attempt.courier_id)) ||
      (detail.courier_service_id && Number(detail.courier_service_id) !== Number(attempt.service_id)) ||
      !STATUS.has(detail.latest_status)) {
    throw Object.assign(new Error('Detail AWB tidak cocok dengan layanan pesanan atau status Jubelio tidak dikenal.'), { status: 409 });
  }
  await query(
    `UPDATE jubelio_shipment_attempts SET state = 'CREATED', awb = ?, jubelio_shipment_id = ?,
     carrier_price = ?, tracking_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [detail.awb, detail.shipment_id || null, Number(detail.price) || null, detail.tracking_url || null, attempt.id],
  );
  await applyStatusUpdate({
    awb: detail.awb,
    latestStatus: detail.latest_status,
    tracking: detail.tracking,
    extras: { trackingUrl: detail.tracking_url, deliveredImgUrl: detail.delivered_img_url, liveTrackingUrl: detail.live_tracking_url },
    source: 'manual',
  });
  return { resolved: true, state: 'CREATED', awb: detail.awb };
}

export async function receiveJubelioWebhook(rawBody, signature, { secret = process.env.JUBELIO_WEBHOOK_SECRET } = {}) {
  if (!secret || !signature || typeof rawBody !== 'string') return { accepted: false, status: 401 };
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const expected = createHmac('sha256', secret).update(rawBody + secret).digest();
  let received;
  try { received = Buffer.from(signature, 'hex'); } catch { return { accepted: false, status: 401 }; }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return { accepted: false, status: 401 };

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return { accepted: false, status: 400 }; }
  if (payload?.event !== 'awb' || !payload?.awb || !payload?.latest_status) {
    return { accepted: false, status: 400 };
  }
  const track = Array.isArray(payload.tracking) ? payload.tracking.at(-1) : payload.tracking;
  const dedupeInput = [payload.awb, payload.latest_status, track?.status || '', track?.date || ''].join('|');
  const key = createHash('sha256').update(dedupeInput).digest('hex');
  const { rowCount } = await query(
    'INSERT IGNORE INTO jubelio_webhook_events (dedupe_key, awb, payload) VALUES (?, ?, ?)',
    [key, String(payload.awb), rawBody],
  );
  if (rowCount === 0) {
    const { rows } = await query('SELECT payload,processed_at FROM jubelio_webhook_events WHERE dedupe_key = ?', [key]);
    const stored = rows[0];
    return {
      accepted: true,
      duplicate: true,
      needsProcessing: Boolean(stored && !stored.processed_at),
      key,
      payload: stored ? (typeof stored.payload === 'string' ? JSON.parse(stored.payload) : stored.payload) : payload,
    };
  }
  return { accepted: true, duplicate: false, needsProcessing: true, key, payload };
}

export async function processJubelioWebhook(key, payload) {
  const result = await applyStatusUpdate({
    awb: payload.awb,
    latestStatus: payload.latest_status,
    tracking: payload.tracking,
    extras: {
      trackingUrl: payload.tracking_url,
      deliveredImgUrl: payload.delivered_img_url,
      signImgUrl: payload.sign_img_url,
      podUrl: payload.pod_url,
      liveTrackingUrl: payload.live_tracking_url,
    },
    source: 'webhook',
  });
  if (result.reason === 'UNKNOWN_AWB') return result;
  await query(
    'UPDATE jubelio_webhook_events SET processed_at = CURRENT_TIMESTAMP, processing_error = NULL WHERE dedupe_key = ?',
    [key],
  );
  return result;
}

export async function reconcileStaleShipments({ olderThanMinutes = 60, client = getJubelioClient() } = {}) {
  const threshold = new Date(Date.now() - Math.max(0, Number(olderThanMinutes) || 0) * 60_000);
  const { rows } = await query(
    `SELECT awb FROM jubelio_shipment_attempts
     WHERE state = 'CREATED' AND awb IS NOT NULL AND jubelio_status NOT IN ('DELIVERED','RETURNED','CANCELED')
       AND COALESCE(last_event_at, created_at) <= ? ORDER BY COALESCE(last_event_at, created_at) LIMIT 100`,
    [threshold],
  );
  const summary = { checked: 0, updated: 0, errors: 0 };
  for (const { awb } of rows) {
    summary.checked += 1;
    try {
      const detail = await client.getShipment(awb);
      const result = await applyStatusUpdate({
        awb,
        latestStatus: detail.latest_status,
        tracking: detail.tracking,
        extras: { trackingUrl: detail.tracking_url, deliveredImgUrl: detail.delivered_img_url, liveTrackingUrl: detail.live_tracking_url },
        source: 'reconcile',
      });
      if (result.applied) summary.updated += 1;
    } catch (error) {
      summary.errors += 1;
      console.error('Jubelio reconciliation failed:', error?.code || error?.message);
    }
  }
  return summary;
}

export async function getPendingWebhookEvents(awb) {
  const { rows } = await query(
    'SELECT dedupe_key, payload FROM jubelio_webhook_events WHERE awb = ? AND processed_at IS NULL ORDER BY received_at',
    [awb],
  );
  return rows.map((row) => ({ key: row.dedupe_key, payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload }));
}
