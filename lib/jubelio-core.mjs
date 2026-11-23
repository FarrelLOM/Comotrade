const positiveInteger = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const shippingError = (message, status = 400) => Object.assign(new Error(message), { status });

export function buildShippingPackage(items, divisor = 6000) {
  if (!Array.isArray(items) || items.length === 0) {
    throw shippingError('Keranjang pengiriman tidak boleh kosong.');
  }
  if (!positiveInteger(divisor)) throw shippingError('Pembagi volumetrik tidak valid.', 500);

  let totalWeightGram = 0;
  let totalValue = 0;
  let length = 0;
  let width = 0;
  let height = 0;

  for (const item of items) {
    const fields = [
      ['quantity', item.quantity],
      ['shipping_weight_gram', item.shipping_weight_gram],
      ['shipping_length_cm', item.shipping_length_cm],
      ['shipping_width_cm', item.shipping_width_cm],
      ['shipping_height_cm', item.shipping_height_cm],
    ];
    for (const [field, value] of fields) {
      if (!positiveInteger(value)) {
        throw shippingError(`Data pengiriman produk ${item.name || item.id} belum lengkap (${field}). Isi berat gram dan dimensi cm melalui admin.`, 422);
      }
    }
    if (Number(item.shipping_weight_gram) > 10_000_000 ||
        [item.shipping_length_cm, item.shipping_width_cm, item.shipping_height_cm].some((value) => Number(value) > 2000)) {
      throw shippingError(`Ukuran paket produk ${item.name || item.id} melebihi batas input yang didukung.`, 422);
    }
    const price = Number(item.price);
    if (!Number.isSafeInteger(price) || price < 0) {
      throw shippingError(`Harga produk ${item.name || item.id} tidak valid.`, 422);
    }

    totalWeightGram += Number(item.shipping_weight_gram) * Number(item.quantity);
    totalValue += price * Number(item.quantity);
    length = Math.max(length, Number(item.shipping_length_cm));
    width = Math.max(width, Number(item.shipping_width_cm));
    height += Number(item.shipping_height_cm) * Number(item.quantity);
  }

  if (!Number.isSafeInteger(totalWeightGram) || !Number.isSafeInteger(totalValue)) {
    throw shippingError('Berat atau nilai keranjang melebihi batas yang didukung.', 422);
  }

  const packageDetail = { length, width, height, weight: totalWeightGram };
  const volumetricWeightGram = Math.ceil((length * width * height * 1000) / divisor);
  return {
    totalWeightGram,
    totalValue,
    packageDetail,
    volumetricWeightGram,
    chargeableWeightGram: Math.max(totalWeightGram, volumetricWeightGram),
  };
}

export function normalizeJubelioRates(rawRates, { cod = false } = {}) {
  if (!Array.isArray(rawRates)) throw shippingError('Respons tarif Jubelio tidak valid.', 502);
  return rawRates
    .map((rate) => {
      const price = Number(rate.rates);
      if (!Number.isSafeInteger(price) || price < 0) return null;
      return {
        courierId: rate.courier_id,
        courierName: String(rate.courier_name || ''),
        serviceId: rate.courier_service_id,
        serviceCode: String(rate.courier_service_code || ''),
        serviceName: String(rate.courier_service_name || ''),
        category: String(rate.courier_service_category || ''),
        price,
        insurance: Number(rate.shipping_insurance) || 0,
        codSupported: Boolean(rate.is_cod_supported),
        codFee: Number(rate.cod_fee) || 0,
        etaFrom: rate.eta_from || null,
        etaTo: rate.eta_to || null,
        logo: rate.courier_logo || null,
      };
    })
    .filter((rate) => rate && (!cod || rate.codSupported))
    .sort((left, right) => left.price - right.price);
}

export function filterCargoQuotes(quotes, totalQuantity) {
  if (totalQuantity <= 30) return quotes;
  return quotes.filter((quote) => /\bcargo\b/i.test(`${quote.category || ''} ${quote.serviceName || ''}`));
}

export function computeBuyerShipping(quote, { subtotal, minSubtotal = 200000, maxSubsidy = 20000, withInsurance = false, cod = false }) {
  const amounts = [quote?.price, quote?.insurance || 0, quote?.codFee || 0, subtotal, minSubtotal, maxSubsidy];
  if (amounts.some((amount) => !Number.isSafeInteger(Number(amount)) || Number(amount) < 0)) {
    throw shippingError('Komponen biaya pengiriman harus berupa Rupiah bulat nonnegatif.', 400);
  }
  const carrierPrice = Number(quote.price);
  const insurance = withInsurance ? Number(quote.insurance || 0) : 0;
  const codFee = cod ? Number(quote.codFee || 0) : 0;
  const subsidy = Number(subtotal) >= Number(minSubtotal)
    ? Math.min(Number(maxSubsidy), carrierPrice)
    : 0;

  return {
    carrierPrice,
    subsidy,
    insurance,
    codFee,
    buyerPays: carrierPrice - subsidy + insurance + codFee,
  };
}
