import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SUPPORTED_CURRENCIES = new Set([
  'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'IDR', 'INR',
  'JPY', 'KRW', 'MYR', 'NZD', 'PHP', 'SGD', 'THB', 'USD',
]);

export async function GET(request) {
  const currency = new URL(request.url).searchParams.get('code')?.toUpperCase() || 'IDR';
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    return NextResponse.json({ error: 'Mata uang belum didukung.' }, { status: 400 });
  }
  if (currency === 'IDR') return NextResponse.json({ currency, rate: 1 });

  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=IDR&symbols=${currency}`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) },
    );
    const data = await response.json();
    const rate = Number(data?.rates?.[currency]);
    if (!response.ok || !Number.isFinite(rate) || rate <= 0) {
      throw new Error('Exchange rate service returned an invalid rate.');
    }
    return NextResponse.json({ currency, rate, date: data.date });
  } catch (error) {
    console.error('Exchange rate lookup failed:', error?.message);
    return NextResponse.json({ error: 'Kurs mata uang asing belum tersedia; harga tetap ditampilkan dalam Rupiah.' }, { status: 503 });
  }
}
