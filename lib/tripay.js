import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function getTripayConfig() {
  const required = ['TRIPAY_API_KEY', 'TRIPAY_PRIVATE_KEY', 'TRIPAY_MERCHANT_CODE'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Tripay configuration is incomplete: ${missing.join(', ')}`);

  const mode = process.env.TRIPAY_MODE || 'sandbox';
  if (!['sandbox', 'production'].includes(mode)) {
    throw new Error('TRIPAY_MODE must be either sandbox or production.');
  }
  const apiBase = mode === 'production'
    ? 'https://tripay.co.id/api'
    : 'https://tripay.co.id/api-sandbox';
  const appUrl = process.env.APP_URL;
  const callbackUrl = process.env.TRIPAY_CALLBACK_URL ||
    (appUrl ? new URL('/api/payments/tripay/callback', appUrl).toString() : '');
  if (!callbackUrl) throw new Error('TRIPAY_CALLBACK_URL or APP_URL must be configured.');
  if (new URL(callbackUrl).protocol !== 'https:' && mode === 'production') {
    throw new Error('TRIPAY_CALLBACK_URL must use HTTPS in production.');
  }
  if (!process.env.TRIPAY_PAYMENT_METHOD) {
    throw new Error('TRIPAY_PAYMENT_METHOD must contain an active payment channel code.');
  }
  if (!appUrl) throw new Error('APP_URL must be configured for the Tripay return URL.');

  return {
    apiKey: process.env.TRIPAY_API_KEY,
    privateKey: process.env.TRIPAY_PRIVATE_KEY,
    merchantCode: process.env.TRIPAY_MERCHANT_CODE,
    paymentMethod: process.env.TRIPAY_PAYMENT_METHOD,
    callbackUrl,
    returnUrl: new URL('/account', appUrl).toString(),
    apiBase,
  };
}

export async function createTripayTransaction(config, order) {
  const amount = Math.round(Number(order.total));
  const signature = createHmac('sha256', config.privateKey)
    .update(`${config.merchantCode}${order.merchant_ref}${amount}`)
    .digest('hex');
  const payload = {
    method: config.paymentMethod,
    merchant_ref: order.merchant_ref,
    amount,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    order_items: order.items,
    callback_url: config.callbackUrl,
    return_url: config.returnUrl,
    expired_time: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    signature,
  };

  const response = await fetch(`${config.apiBase}/transaction/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok || result.success !== true || !result.data) {
    throw new Error(result.message || 'Tripay gagal membuat transaksi.');
  }
  return result.data;
}

export function verifyTripayCallback(rawBody, signature, privateKey) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', privateKey).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
