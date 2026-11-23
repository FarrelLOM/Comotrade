'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/app/components/CurrencyProvider';
import styles from './checkout.module.css';

const DeliveryMap = dynamic(() => import('./DeliveryMap'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Memuat peta…</div>,
});

const regionArea = (region) => region.area || region.area_name || region.name || '';
const regionDistrict = (region) => region.district || region.district_name || '';
const regionCity = (region) => region.city || region.city_name || '';
const regionProvince = (region) => region.province || region.province_name || '';
const uniqueValues = (values) => [...new Set(values.filter(Boolean))];
const currentReturnTo = () => `${window.location.pathname}${window.location.search}`;

function normalizedName(value) {
  return String(value || '').toLocaleLowerCase('id')
    .replace(/\b(kabupaten|kab\.|kota|kec\.|kecamatan|administrasi)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export default function Checkout() {
  const router = useRouter();
  const { format } = useCurrency();
  const [items, setItems] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState('');
  const [addressLabel, setAddressLabel] = useState('Rumah');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [destination, setDestination] = useState({ areaId: '', zipcode: '', coordinate: '', areaName: '', districtName: '', cityName: '', provinceName: '' });
  const [regionSearch, setRegionSearch] = useState('');
  const [regions, setRegions] = useState([]);
  const [regionSelection, setRegionSelection] = useState({ province: '', city: '', district: '', areaId: '' });
  const [quotes, setQuotes] = useState([]);
  const [paymentChannels, setPaymentChannels] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [cargoOnly, setCargoOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [subtotal, setSubtotal] = useState(0);
  const [withInsurance, setWithInsurance] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const cart = JSON.parse(localStorage.getItem('comotrade_cart') || '[]');
      setItems(Array.isArray(cart) ? cart : []);
    } catch { setItems([]); }
    fetch('/api/addresses', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(currentReturnTo())}`);
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Alamat belum dapat dimuat.');
      setAddresses(data.addresses || []);
      setAddressId(data.addresses?.find((address) => address.is_default)?.id || data.addresses?.[0]?.id || '');
    }).catch((cause) => setError(cause.message));
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch('/api/payments/tripay/channels', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(currentReturnTo())}`);
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Kanal pembayaran Tripay belum dapat dimuat.');
      if (active) {
        setPaymentChannels(data.channels || []);
        setPaymentMethod(data.channels?.[0]?.code || '');
      }
    }).catch((cause) => {
      if (active) setError(cause.message);
    }).finally(() => {
      if (active) setPaymentLoading(false);
    });
    return () => { active = false; };
  }, [router]);

  const selectedAddress = addresses.find((address) => address.id === addressId);
  useEffect(() => {
    if (!selectedAddress) return;
    setAddressLabel(selectedAddress.label || 'Rumah');
    setRecipientName(selectedAddress.recipient_name || '');
    setRecipientPhone(selectedAddress.recipient_phone || '');
    setAddressLine(selectedAddress.address_line || '');
    setDestination({
      areaId: selectedAddress.area_id || '', zipcode: selectedAddress.zipcode || '',
      coordinate: selectedAddress.coordinate || '', areaName: selectedAddress.area_name || '',
      districtName: selectedAddress.district_name || '', cityName: selectedAddress.city_name || '',
      provinceName: selectedAddress.province_name || '',
    });
    setRegionSelection({ province: selectedAddress.province_name || '', city: selectedAddress.city_name || '', district: selectedAddress.district_name || '', areaId: selectedAddress.area_id || '' });
    setRegions([]);
    setQuotes([]);
    setSelected(null);
  }, [selectedAddress]);

  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const provinceOptions = uniqueValues(regions.map(regionProvince));
  const provinceRegions = regions.filter((region) => !regionSelection.province || regionProvince(region) === regionSelection.province);
  const cityOptions = uniqueValues(provinceRegions.map(regionCity));
  const cityRegions = provinceRegions.filter((region) => !regionSelection.city || regionCity(region) === regionSelection.city);
  const districtOptions = uniqueValues(cityRegions.map(regionDistrict));
  const districtRegions = cityRegions.filter((region) => !regionSelection.district || regionDistrict(region) === regionSelection.district);
  const areaOptions = districtRegions;

  function invalidateRates() {
    setQuotes([]);
    setSelected(null);
    setCargoOnly(false);
  }

  async function searchRegions() {
    if (regionSearch.trim().length < 3) {
      setError('Masukkan minimal 3 karakter untuk mencari wilayah.');
      return;
    }
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/shipping/regions?q=${encodeURIComponent(regionSearch.trim())}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Wilayah belum dapat dicari.');
      setRegions(data.regions || []);
      setRegionSelection({ province: '', city: '', district: '', areaId: '' });
      if (!data.regions?.length) setError('Wilayah tidak ditemukan. Periksa ejaan atau cari nama kecamatan/kota.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }

  function chooseRegion(level, value) {
    const next = { ...regionSelection, [level]: value };
    if (level === 'province') Object.assign(next, { city: '', district: '', areaId: '' });
    if (level === 'city') Object.assign(next, { district: '', areaId: '' });
    if (level === 'district') next.areaId = '';
    setRegionSelection(next);
    if (level !== 'areaId') {
      setDestination((current) => ({
        ...current,
        areaId: '', zipcode: '', areaName: '',
        districtName: level === 'district' ? value : '',
        cityName: level === 'city' || level === 'district' ? next.city : '',
        provinceName: level === 'province' ? value : next.province,
      }));
      invalidateRates();
      return;
    }
    const region = regions.find((entry) => String(entry.area_id) === value);
    if (!region) return;
    setDestination((current) => ({
      ...current, areaId: String(region.area_id), zipcode: String(region.zipcode),
      areaName: regionArea(region), districtName: regionDistrict(region),
      cityName: regionCity(region), provinceName: regionProvince(region),
    }));
    invalidateRates();
  }

  async function loadQuotes(event) {
    event?.preventDefault();
    setBusy(true); setError(''); setSelected(null); setQuotes([]);
    try {
      const response = await fetch('/api/shipping/rates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressId, destination, items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })) }),
      });
      const data = await response.json();
      if (response.status === 401) { router.replace(`/login?returnTo=${encodeURIComponent(currentReturnTo())}`); return; }
      if (!response.ok) throw new Error(data.error || 'Tarif kurir belum dapat dihitung.');
      setSubtotal(Number(data.subtotal));
      setQuotes(data.quotes || []);
      setCargoOnly(Boolean(data.cargoOnly));
      if (!data.quotes?.length) throw new Error('Tidak ada layanan kurir untuk alamat ini.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }

  function displayedShipping(quote) {
    const base = Number(quote.buyer.buyerPays);
    return base + (withInsurance ? Number(quote.insurance || 0) : 0);
  }

  async function confirmOrder() {
    if (!selected || !addressId || !paymentMethod) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId,
          warehouseId: selected.warehouseId || null,
          recipientName,
          recipientPhone,
          addressLine,
          customerNote,
          destination,
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          courierId: selected.courierId,
          serviceId: selected.serviceId,
          expectedCarrierPrice: selected.price,
          withInsurance,
        }),
      });
      const data = await response.json();
      if (response.status === 401) { router.replace(`/login?returnTo=${encodeURIComponent(currentReturnTo())}`); return; }
      if (!response.ok) throw new Error(data.error || 'Konfirmasi pesanan gagal.');
      localStorage.removeItem('comotrade_cart');
      try {
        const paymentResponse = await fetch(`/api/orders/${data.order.id}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethod }),
        });
        const payment = await paymentResponse.json();
        if (paymentResponse.ok && payment.payment?.payment_url) {
          window.location.assign(payment.payment.payment_url);
          return;
        }
        router.replace(`/account?order=${data.order.id}&payment=pending`);
      } catch {
        router.replace(`/account?order=${data.order.id}&payment=pending`);
      }
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }

  if (!items.length) return <main className={`${styles.page} commerce-surface`}><Link className={styles.back} href="/cart">← Kembali ke keranjang</Link><section className={styles.panel}><h1>Checkout</h1><p>Keranjang kosong. Tambahkan produk sebelum melanjutkan.</p><Link className={styles.action} href="/">Pilih produk</Link></section></main>;

  const provinceMatches = regions.filter((region) => regionProvince(region) === regionSelection.province);
  const cityMatches = provinceMatches.filter((region) => regionCity(region) === regionSelection.city);
  const districtMatches = cityMatches.filter((region) => regionDistrict(region) === regionSelection.district);

  async function fillAddressFromCoordinate(coordinate) {
    const [latitude, longitude] = coordinate.split(',').map((part) => part.trim());
    const response = await fetch(`/api/shipping/geocode?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`, { cache: 'no-store' });
    const data = await response.json();
    if (response.status === 401) {
      router.replace(`/login?returnTo=${encodeURIComponent(currentReturnTo())}`);
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Alamat otomatis belum dapat ditemukan.');

    const address = data.address || {};
    const localParts = [
      [address.house_number, address.road].filter(Boolean).join(' '),
      address.building,
      address.neighbourhood,
      address.suburb,
      address.village || address.hamlet,
    ].filter(Boolean);
    setAddressLine([...new Set(localParts)].join(', ') || data.displayName || '');
    setDestination((current) => ({ ...current, coordinate }));
    invalidateRates();

    const localArea = address.village || address.hamlet || address.suburb || address.neighbourhood || '';
    const city = address.city || address.town || address.municipality || '';
    const district = address.city_district || address.district || address.county || '';
    const province = address.state || address.province || '';
    const searchTerm = [localArea, district, city].find((value) => String(value || '').trim().length >= 3) || province;
    setRegionSearch(searchTerm || '');
    if (String(searchTerm || '').trim().length < 3) {
      setNotice('Alamat jalan terisi. Pilih wilayah tujuan secara manual agar ongkir dapat dihitung.');
      return;
    }

    const regionResponse = await fetch(`/api/shipping/regions?q=${encodeURIComponent(searchTerm)}`, { cache: 'no-store' });
    const regionData = await regionResponse.json();
    if (!regionResponse.ok) throw new Error(regionData.error || 'Wilayah hasil lokasi belum dapat dicari.');
    const foundRegions = regionData.regions || [];
    setRegions(foundRegions);
    const matchingRegions = foundRegions.filter((region) => {
      const areaMatches = !localArea || normalizedName(regionArea(region)) === normalizedName(localArea);
      const cityMatches = !city || normalizedName(regionCity(region)).includes(normalizedName(city)) ||
        normalizedName(city).includes(normalizedName(regionCity(region)));
      const provinceMatches = !province || normalizedName(regionProvince(region)).includes(normalizedName(province)) ||
        normalizedName(province).includes(normalizedName(regionProvince(region)));
      return areaMatches && cityMatches && provinceMatches;
    });
    if (matchingRegions.length === 1) {
      const region = matchingRegions[0];
      setRegionSelection({
        province: regionProvince(region),
        city: regionCity(region),
        district: regionDistrict(region),
        areaId: String(region.area_id),
      });
      setDestination((current) => ({
        ...current,
        areaId: String(region.area_id),
        zipcode: String(region.zipcode),
        areaName: regionArea(region),
        districtName: regionDistrict(region),
        cityName: regionCity(region),
        provinceName: regionProvince(region),
      }));
      setNotice('Alamat dan wilayah tujuan berhasil diisi dari lokasi. Periksa kembali pin dan alamat sebelum melanjutkan.');
    } else {
      setRegionSelection({ province: '', city: '', district: '', areaId: '' });
      setDestination((current) => ({
        ...current,
        areaId: '',
        zipcode: '',
        areaName: '',
        districtName: district || '',
        cityName: city || '',
        provinceName: province || '',
      }));
      setNotice(foundRegions.length
        ? 'Alamat terisi. Pilih provinsi, kota, kecamatan, dan kelurahan yang cocok dengan pin untuk menghitung ongkir.'
        : 'Alamat jalan terisi, tetapi wilayah kurir tidak ditemukan otomatis. Cari dan pilih wilayah tujuan.');
    }
  }

  async function trackMyLocation() {
    if (!navigator.geolocation) {
      setError('Perangkat ini tidak menyediakan layanan lokasi.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    navigator.geolocation.getCurrentPosition(async (position) => {
      const coordinate = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;
      setDestination((current) => ({ ...current, coordinate }));
      invalidateRates();
      try {
        await fillAddressFromCoordinate(coordinate);
      } catch (cause) {
        setError(cause.message);
      } finally {
        setBusy(false);
      }
    }, () => {
      setError('Lokasi tidak dapat diakses. Izinkan akses lokasi pada browser atau pin peta secara manual.');
      setBusy(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }

  async function lookupPinnedAddress() {
    if (!destination.coordinate) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await fillAddressFromCoordinate(destination.coordinate);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAddressChanges() {
    setBusy(true); setError(''); setNotice('');
    try {
      const creating = !selectedAddress;
      const response = await fetch(creating ? '/api/addresses' : `/api/addresses/${selectedAddress.id}`, {
        method: creating ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: addressLabel,
          recipientName,
          recipientPhone,
          addressLine,
          areaId: destination.areaId,
          zipcode: destination.zipcode,
          areaName: destination.areaName,
          districtName: destination.districtName,
          cityName: destination.cityName,
          provinceName: destination.provinceName,
          coordinate: destination.coordinate,
          isDefault: creating || Boolean(selectedAddress.is_default),
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(currentReturnTo())}`);
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Perubahan alamat belum dapat disimpan.');
      const saved = data.address;
      const updated = {
        id: saved.id,
        label: saved.label,
        recipient_name: saved.recipientName,
        recipient_phone: saved.recipientPhone,
        address_line: saved.addressLine,
        area_id: saved.areaId,
        zipcode: saved.zipcode,
        area_name: saved.areaName,
        district_name: saved.districtName,
        city_name: saved.cityName,
        province_name: saved.provinceName,
        coordinate: saved.coordinate,
        is_default: saved.isDefault,
      };
      setAddresses((current) => creating
        ? [updated, ...current]
        : current.map((address) => address.id === updated.id ? updated : address));
      setAddressId(updated.id);
      setNotice(creating ? 'Alamat baru berhasil disimpan di buku alamat Anda.' : 'Alamat berhasil diperbarui di buku alamat Anda.');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`${styles.page} commerce-surface`}>
      <Link className={styles.back} href="/cart">← Keranjang</Link>
      <header className={styles.heading}><span>LANGKAH TERAKHIR</span><h1>Konfirmasi pesanan</h1><p>Periksa penerima, layanan pengiriman, dan total sebelum melanjutkan ke pembayaran Tripay.</p></header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <div className={styles.layout}>
        <section className={styles.mainColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeading}><h2>Alamat pengiriman</h2><Link className={styles.secondaryAction} href="/account/addresses">Kelola alamat</Link></div>
            {addresses.length > 0 && <label className={styles.label}>Alamat tersimpan<select value={addressId} onChange={(event) => {
              const nextId = event.target.value;
              setAddressId(nextId);
              invalidateRates();
              if (!nextId) {
                setAddressLabel('Alamat baru');
                setRecipientName('');
                setRecipientPhone('');
                setAddressLine('');
                setDestination({ areaId: '', zipcode: '', coordinate: '', areaName: '', districtName: '', cityName: '', provinceName: '' });
                setRegionSelection({ province: '', city: '', district: '', areaId: '' });
                setRegions([]);
              }
            }}>
                <option value="">＋ Tambahkan alamat baru</option>
                {addresses.map((address) => <option value={address.id} key={address.id}>{address.label} · {address.recipient_name} · {address.city_name}</option>)}
              </select></label>}
              {!selectedAddress && <p className={styles.regionSummary}>Isi manual atau gunakan GPS, lalu simpan ke buku alamat sebelum menghitung ongkir.</p>}
              <div className={styles.contactFields}>
                <label className={styles.label}>Label alamat<input value={addressLabel} onChange={(event) => setAddressLabel(event.target.value)} maxLength={60} required /></label>
                <label className={styles.label}>Nama penerima<input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} maxLength={120} required /></label>
                <label className={styles.label}>Nomor telepon<input type="tel" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} maxLength={30} required /></label>
                <label className={`${styles.label} ${styles.full}`}>Alamat jalan dan patokan<textarea value={addressLine} onChange={(event) => setAddressLine(event.target.value)} minLength={8} maxLength={1000} rows={3} required /></label>
                <label className={`${styles.label} ${styles.full}`}>Catatan untuk kurir (opsional)<input value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} maxLength={1000} placeholder="Contoh: rumah pagar hijau, dekat pos ronda" /></label>
              </div>
              <div className={styles.regionEditor}>
                <div className={styles.panelHeading}><h3>Wilayah tujuan</h3><span>Data area Jubelio</span></div>
                <div className={styles.regionSearch}><input value={regionSearch} onChange={(event) => setRegionSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); searchRegions(); } }} placeholder="Cari kelurahan, kecamatan, kabupaten, atau provinsi" /><button type="button" className={styles.secondary} disabled={busy} onClick={searchRegions}>Cari wilayah</button></div>
                {regions.length > 0 && <div className={styles.regionFields}>
                  <label className={styles.label}>Provinsi<select value={regionSelection.province} onChange={(event) => chooseRegion('province', event.target.value)}><option value="">Pilih provinsi</option>{provinceOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
                  <label className={styles.label}>Kabupaten / kota<select value={regionSelection.city} disabled={!regionSelection.province} onChange={(event) => chooseRegion('city', event.target.value)}><option value="">Pilih kabupaten/kota</option>{uniqueValues(provinceMatches.map(regionCity)).map((name) => <option key={name}>{name}</option>)}</select></label>
                  <label className={styles.label}>Kecamatan<select value={regionSelection.district} disabled={!regionSelection.city} onChange={(event) => chooseRegion('district', event.target.value)}><option value="">Pilih kecamatan</option>{uniqueValues(cityMatches.map(regionDistrict)).map((name) => <option key={name}>{name}</option>)}</select></label>
                  <label className={styles.label}>Kelurahan / desa<select value={regionSelection.areaId} disabled={!regionSelection.district} onChange={(event) => chooseRegion('areaId', event.target.value)}><option value="">Pilih kelurahan/desa</option>{districtMatches.map((region) => <option key={region.area_id} value={region.area_id}>{regionArea(region)} · {region.zipcode}</option>)}</select></label>
                </div>}
                <p className={styles.regionSummary}>{destination.areaId ? `${destination.areaName}, ${destination.districtName}, ${destination.cityName}, ${destination.provinceName} · ${destination.zipcode}` : 'Pilih wilayah tujuan melalui pencarian di atas.'}</p>
              </div>
              <div className={styles.mapSection}><div className={styles.panelHeading}><h3>Titik pengiriman</h3><button type="button" className={styles.secondary} disabled={busy} onClick={trackMyLocation}>{busy ? 'Memproses…' : 'Gunakan GPS saya'}</button></div><p>GPS hanya membaca lokasi sekali setelah izin diberikan. Koordinat digunakan untuk mencari perkiraan alamat melalui OpenStreetMap; pin dan alamat dapat Anda periksa atau ubah sebelum memesan.</p><DeliveryMap coordinate={destination.coordinate} onChange={(coordinate) => { setDestination((current) => ({ ...current, coordinate })); invalidateRates(); setNotice('Pin berubah. Isi alamat dari titik peta untuk memperbarui alamat dan wilayah kurir.'); }} /><button type="button" className={styles.secondary} disabled={busy || !destination.coordinate} onClick={lookupPinnedAddress}>Isi alamat dari titik peta</button><label className={styles.label}>Koordinat tujuan<input value={destination.coordinate} onChange={(event) => { setDestination((current) => ({ ...current, coordinate: event.target.value })); invalidateRates(); }} maxLength={80} placeholder="-6.21,106.81" /></label></div>
              <button type="button" className={styles.saveAddress} disabled={busy || !destination.areaId} onClick={saveAddressChanges}>{selectedAddress ? 'Simpan perubahan ke buku alamat' : 'Simpan alamat ke buku alamat'}</button>
              <button className={styles.secondary} disabled={busy || !addressId || !destination.areaId} onClick={loadQuotes}>{busy ? 'Memproses…' : 'Hitung tarif pengiriman'}</button>
          </article>

          <article className={styles.panel}><h2>Produk</h2><div className={styles.items}>{items.map((item) => <div className={styles.item} key={item.productId}>{item.imageUrl && <img src={item.imageUrl} alt="" />}<div><strong>{item.name}</strong><span>{item.quantity} × {format(item.price)}</span></div><b>{format(Number(item.price) * Number(item.quantity))}</b></div>)}</div></article>

          <article className={styles.panel}><h2>Metode pengiriman</h2>{cargoOnly && <p className={styles.cargoNotice}>Jumlah pesanan {totalQuantity} unit. Hanya layanan Cargo yang ditampilkan.</p>}{quotes.length ? <div className={styles.quoteList}>{quotes.map((quote) => <label className={`${styles.quote} ${selected?.serviceId === quote.serviceId && selected?.courierId === quote.courierId && selected?.warehouseId === quote.warehouseId ? styles.quoteSelected : ''}`} key={`${quote.warehouseId || 'legacy'}-${quote.courierId}-${quote.serviceId}`}>
            <input type="radio" name="shipping" checked={selected?.serviceId === quote.serviceId && selected?.courierId === quote.courierId && selected?.warehouseId === quote.warehouseId} onChange={() => setSelected(quote)} />
            <span className={styles.quoteText}><strong>{quote.courierName} · {quote.serviceName}</strong><small>{quote.category}{quote.etaFrom && quote.etaTo ? ` · ${new Date(quote.etaFrom).toLocaleDateString('id-ID')}–${new Date(quote.etaTo).toLocaleDateString('id-ID')}` : ''}{quote.warehouseName ? ` · Gudang ${quote.warehouseName}` : ''}</small></span>
            <b>{format(displayedShipping(quote))}</b>
          </label>)}</div> : <p>Pilih alamat, lalu hitung tarif untuk melihat layanan yang tersedia.</p>}
            {selected && selected.insurance > 0 && <label className={styles.insurance}><input type="checkbox" checked={withInsurance} onChange={(event) => setWithInsurance(event.target.checked)} /> Sertakan premi asuransi {format(selected.insurance)}</label>}
          </article>
          <article className={styles.panel}><h2>Metode pembayaran</h2>
            {paymentLoading ? <p>Memuat kanal pembayaran Tripay…</p> : paymentChannels.length ? <div className={styles.quoteList}>
              {paymentChannels.map((channel) => <label className={`${styles.quote} ${paymentMethod === channel.code ? styles.quoteSelected : ''}`} key={channel.code}>
                <input type="radio" name="payment-method" value={channel.code} checked={paymentMethod === channel.code} onChange={() => setPaymentMethod(channel.code)} />
                <span className={styles.quoteText}><strong>{channel.name}</strong><small>{[channel.group, channel.type].filter(Boolean).join(' · ') || 'Pembayaran melalui Tripay'}</small></span>
              </label>)}
            </div> : <p>Kanal pembayaran belum tersedia. Periksa konfigurasi dan kanal aktif pada akun Tripay.</p>}
            <p className={styles.paymentNote}>Kanal yang ditampilkan mengikuti kanal aktif di akun Tripay. Biaya atau petunjuk tambahan akan dikonfirmasi oleh Tripay.</p>
          </article>
        </section>

        <aside className={styles.summary}><h2>Ringkasan pembayaran</h2><p>Subtotal produk <strong>{format(subtotal || items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0))}</strong></p><p>Ongkir pembeli <strong>{selected ? format(displayedShipping(selected)) : 'Pilih kurir'}</strong></p><p className={styles.total}>Total <strong>{format((subtotal || items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)) + (selected ? displayedShipping(selected) : 0))}</strong></p><p className={styles.paymentNote}>Pembayaran akan dibuat melalui Tripay dalam IDR. Harga produk dan ongkir diverifikasi ulang oleh server.</p><button className={styles.action} disabled={busy || paymentLoading || !selected || !addresses.length || !paymentMethod} onClick={confirmOrder}>{busy ? 'Memproses…' : 'Konfirmasi dan lanjut bayar'}</button></aside>
      </div>
    </main>
  );
}
