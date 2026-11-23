import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShippingPackage, computeBuyerShipping, filterCargoQuotes, normalizeJubelioRates } from '../lib/jubelio-core.mjs';

test('berat paket menggunakan gram dan dimensi cm dengan volumetrik sebagai estimasi', () => {
  const result = buildShippingPackage([{
    id: 'bantal', name: 'Bantal', price: 90000, quantity: 1,
    shipping_weight_gram: 500, shipping_length_cm: 60,
    shipping_width_cm: 40, shipping_height_cm: 20,
  }]);
  assert.equal(result.totalWeightGram, 500);
  assert.deepEqual(result.packageDetail, { length: 60, width: 40, height: 20, weight: 500 });
  assert.equal(result.volumetricWeightGram, 8000);
  assert.equal(result.chargeableWeightGram, 8000);
});

test('paket menumpuk tinggi dan mengambil harga dari data server', () => {
  const result = buildShippingPackage([
    { id: 'a', name: 'A', price: 10000, quantity: 2, shipping_weight_gram: 200, shipping_length_cm: 10, shipping_width_cm: 8, shipping_height_cm: 3 },
    { id: 'b', name: 'B', price: 5000, quantity: 1, shipping_weight_gram: 300, shipping_length_cm: 5, shipping_width_cm: 5, shipping_height_cm: 9 },
  ]);
  assert.equal(result.totalWeightGram, 700);
  assert.equal(result.totalValue, 25000);
  assert.deepEqual(result.packageDetail, { length: 10, width: 8, height: 15, weight: 700 });
  assert.throws(() => buildShippingPackage([{ ...{
    id: 'legacy', name: 'Tanpa dimensi', price: 1, quantity: 1,
  } }]), /shipping_weight_gram/);
});

test('tarif mengambil rates, mengurutkan murah, dan memfilter COD', () => {
  const result = normalizeJubelioRates([
    { rates: 20000, courier_id: 1, courier_service_id: 1, is_cod_supported: false },
    { rates: 12000, courier_id: 2, courier_service_id: 2, is_cod_supported: true, cod_fee: 3000 },
    { rates: 9000, final_rates: 7000, courier_id: 3, courier_service_id: 3, is_cod_supported: true },
  ], { cod: true });
  assert.deepEqual(result.map((quote) => quote.price), [9000, 12000]);
  assert.deepEqual(result.map((quote) => quote.codSupported), [true, true]);
  assert.equal(normalizeJubelioRates([{ final_rates: 1000 }]).length, 0);
});

test('jumlah lebih dari 30 hanya mengizinkan layanan Cargo', () => {
  const quotes = [
    { serviceName: 'Regular', category: 'Parcel' },
    { serviceName: 'Cargo Economy', category: 'Economy' },
    { serviceName: 'Premium Cargo', category: 'Premium' },
  ];
  assert.equal(filterCargoQuotes(quotes, 30).length, 3);
  assert.deepEqual(filterCargoQuotes(quotes, 31), [quotes[1], quotes[2]]);
});

test('subsidi, asuransi, dan COD fee dihitung sebagai rupiah bulat', () => {
  const result = computeBuyerShipping(
    { price: 30000, insurance: 500, codFee: 3000 },
    { subtotal: 250000, minSubtotal: 200000, maxSubsidy: 20000, withInsurance: true, cod: true },
  );
  assert.deepEqual(result, { carrierPrice: 30000, subsidy: 20000, insurance: 500, codFee: 3000, buyerPays: 13500 });
  assert.throws(() => computeBuyerShipping({ price: -1 }, { subtotal: 0 }), /nonnegatif/);
});
