'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CurrencyContext = createContext({
  currency: 'IDR',
  format: (amount) => `Rp ${Number(amount).toLocaleString('id-ID')}`,
  rateError: '',
});

const REGION_CURRENCIES = {
  AT: 'EUR', AU: 'AUD', BE: 'EUR', BR: 'BRL', CA: 'CAD', CH: 'CHF',
  CN: 'CNY', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR', FI: 'EUR',
  FR: 'EUR', GB: 'GBP', GR: 'EUR', HR: 'EUR', ID: 'IDR', IE: 'EUR',
  IN: 'INR', IT: 'EUR', JP: 'JPY', KR: 'KRW', LT: 'EUR', LU: 'EUR',
  LV: 'EUR', MT: 'EUR', MY: 'MYR', NL: 'EUR', NZ: 'NZD', PH: 'PHP',
  PT: 'EUR', SI: 'EUR', SK: 'EUR', SG: 'SGD', TH: 'THB', US: 'USD',
};

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState('IDR');
  const [displayLocale, setDisplayLocale] = useState('id-ID');
  const [rate, setRate] = useState(1);
  const [rateError, setRateError] = useState('');

  useEffect(() => {
    const locale = navigator.language || 'id-ID';
    setDisplayLocale(locale);
    let region = '';
    try {
      region = new Intl.Locale(locale).region || '';
    } catch {
      region = locale.split('-')[1]?.toUpperCase() || '';
    }
    const selectedCurrency = REGION_CURRENCIES[region] || 'IDR';
    setCurrency(selectedCurrency);
    if (selectedCurrency === 'IDR') return;

    let active = true;
    fetch(`/api/currency?code=${selectedCurrency}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Kurs mata uang belum tersedia.');
        if (active) setRate(data.rate);
      })
      .catch((error) => {
        if (!active) return;
        setCurrency('IDR');
        setRate(1);
        setRateError(error.message);
      });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    currency,
    rateError,
    format(amount) {
      return new Intl.NumberFormat(displayLocale, {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'IDR' || currency === 'JPY' || currency === 'KRW' ? 0 : 2,
      }).format(Number(amount) * rate);
    },
  }), [currency, displayLocale, rate, rateError]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
      {rateError && <div className="currency-warning" role="status">{rateError}</div>}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
