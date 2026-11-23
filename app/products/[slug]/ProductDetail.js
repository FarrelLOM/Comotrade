'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCurrency } from '@/app/components/CurrencyProvider';
import styles from './product.module.css';

const regionArea = (region) => region.area || region.area_name || region.name || '';
const regionDistrict = (region) => region.district || region.district_name || '';
const regionCity = (region) => region.city || region.city_name || '';
const regionProvince = (region) => region.province || region.province_name || '';
const uniqueValues = (values) => [...new Set(values.filter(Boolean))];

export default function ProductDetail() {
  const { slug } = useParams();
  const router = useRouter();
  const { format } = useCurrency();
  const [product, setProduct] = useState(null);
  const [catalogFallback, setCatalogFallback] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalAction, setModalAction] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [shippingQuotes, setShippingQuotes] = useState([]);
  const [shippingEstimateStatus, setShippingEstimateStatus] = useState('');
  const [regionSearch, setRegionSearch] = useState('');
  const [regions, setRegions] = useState([]);
  const [regionSelection, setRegionSelection] = useState({ province: '', city: '', district: '', areaId: '' });
  const [shippingDestination, setShippingDestination] = useState({ areaId: '', zipcode: '', coordinate: '' });
  const [sessionUser, setSessionUser] = useState(null);
  const [adminForm, setAdminForm] = useState({
    name: '',
    description: '',
    longDescription: '',
    harvestDuration: '',
    price: '',
    stock: '',
    satuan: '',
    origin: '',
    imageUrl: '',
    category: '',
    slug: '',
    highlights: '',
    gallery: '',
  });
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminNotice, setAdminNotice] = useState('');
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (active) setSessionUser(response.ok ? data.user || null : null);
    }).catch(() => { if (active) setSessionUser(null); });

    fetch(`/api/products/${encodeURIComponent(slug)}`, { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Produk tidak tersedia.');
      if (active) {
        setProduct(data.product);
        setAdminForm({
          name: data.product.name || '',
          description: data.product.description || '',
          longDescription: data.product.long_description || '',
          harvestDuration: data.product.harvest_duration || '',
          price: String(data.product.price ?? ''),
          stock: String(data.product.stock ?? ''),
          satuan: data.product.satuan || 'unit',
          origin: data.product.origin || '',
          imageUrl: data.product.image_url || '',
          category: data.product.category || 'Rempah',
          slug: data.product.slug || '',
          highlights: Array.isArray(data.product.highlights) ? data.product.highlights.join('\n') : '',
          gallery: Array.isArray(data.product.gallery) ? data.product.gallery.join('\n') : '',
        });
      }
    }).catch((cause) => {
      if (!active) return;
      const params = new URLSearchParams(window.location.search);
      const name = params.get('name');
      const image = params.get('image');
      if (name && image) {
        const fallback = { name, image_url: image, stock: 0, satuan: 'unit', price: 0, origin: '', description: '', category: 'Rempah' };
        setCatalogFallback(fallback);
        setAdminForm((current) => ({
          ...current,
          name,
          slug: String(slug || ''),
          imageUrl: image,
          category: fallback.category,
          satuan: fallback.satuan,
          price: '',
          stock: '',
        }));
      }
      else setError(cause.message);
    });
    fetch(`/api/reviews?product=${encodeURIComponent(slug)}`, { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (response.ok && active) setReviews(data.reviews || []);
    }).catch(() => {});
    return () => { active = false; };
  }, [slug]);

  const gallery = product ? [product.image_url, ...(product.gallery || [])].filter((image, index, images) => image && images.indexOf(image) === index) : [];
  useEffect(() => {
    setGalleryIndex(0);
  }, [slug]);
  useEffect(() => {
    if (gallery.length < 2) return undefined;
    const timer = window.setInterval(() => setGalleryIndex((index) => (index + 1) % gallery.length), 2000);
    return () => window.clearInterval(timer);
  }, [gallery.length]);

  useEffect(() => {
    if (!modalAction || !product) return undefined;
    const controller = new AbortController();
    let active = true;
    if (!shippingDestination.areaId || !shippingDestination.zipcode) {
      setShippingQuotes([]);
      setShippingEstimateStatus('Pilih provinsi, kabupaten/kota, dan kecamatan tujuan.');
      return () => { active = false; controller.abort(); };
    }
    setShippingQuotes([]);
    setShippingEstimateStatus('Menghitung estimasi pengiriman…');
    const timer = window.setTimeout(async () => {
      try {
        const rateResponse = await fetch('/api/shipping/rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            destination: shippingDestination,
            items: [{ productId: product.id, quantity }],
          }),
        });
        const rateData = await rateResponse.json();
        if (!rateResponse.ok) throw new Error(rateData.error || 'Estimasi kurir belum tersedia.');
        if (active) {
          setShippingQuotes(rateData.quotes || []);
          setShippingEstimateStatus(rateData.quotes?.length ? '' : 'Belum ada layanan untuk alamat ini.');
        }
      } catch (cause) {
        if (active && cause.name !== 'AbortError') setShippingEstimateStatus(cause.message || 'Estimasi kurir belum tersedia.');
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [modalAction, product, quantity, shippingDestination]);

  async function searchShippingRegions() {
    if (regionSearch.trim().length < 3) {
      setShippingEstimateStatus('Masukkan minimal 3 karakter untuk mencari wilayah.');
      return;
    }
    setShippingEstimateStatus('Mencari wilayah tujuan…');
    try {
      const response = await fetch(`/api/shipping/regions?q=${encodeURIComponent(regionSearch.trim())}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Wilayah belum dapat dicari.');
      setRegions(data.regions || []);
      setRegionSelection({ province: '', city: '', district: '', areaId: '' });
      setShippingDestination({ areaId: '', zipcode: '', coordinate: '' });
      setShippingEstimateStatus(data.regions?.length ? 'Pilih provinsi, kabupaten/kota, kecamatan, lalu kelurahan.' : 'Wilayah tidak ditemukan.');
    } catch (cause) {
      setShippingEstimateStatus(cause.message || 'Wilayah belum dapat dicari.');
    }
  }

  function chooseShippingRegion(level, value) {
    const next = { ...regionSelection, [level]: value };
    if (level === 'province') Object.assign(next, { city: '', district: '', areaId: '' });
    if (level === 'city') Object.assign(next, { district: '', areaId: '' });
    if (level === 'district') next.areaId = '';
    setRegionSelection(next);
    setShippingDestination((current) => ({ ...current, areaId: '', zipcode: '' }));
    if (level !== 'areaId') return;
    const region = regions.find((entry) => String(entry.area_id) === value);
    if (!region) return;
    setShippingDestination({ areaId: String(region.area_id), zipcode: String(region.zipcode), coordinate: '' });
  }

  function currentCartItem() {
    return { productId: product.id, slug: product.slug, name: product.name, price: Number(product.price), imageUrl: product.image_url, satuan: product.satuan || 'unit', quantity };
  }

  function confirmOrder() {
    try {
      const cart = JSON.parse(localStorage.getItem('comotrade_cart') || '[]');
      if (!Array.isArray(cart)) throw new Error('Keranjang tidak valid.');
      if (modalAction === 'cart') {
        const existing = cart.find((item) => item.productId === product.id);
        if (existing && Number(existing.quantity) + quantity > Number(product.stock)) {
          setNotice('Jumlah di keranjang melebihi stok yang tersedia.');
          return;
        }
        if (existing) existing.quantity = Number(existing.quantity) + quantity;
        else cart.push(currentCartItem());
        localStorage.setItem('comotrade_cart', JSON.stringify(cart));
        setNotice('Produk ditambahkan ke keranjang.');
        setModalAction('');
        return;
      }
      localStorage.setItem('comotrade_cart', JSON.stringify([currentCartItem()]));
      router.push('/checkout');
    } catch {
      setNotice('Keranjang belum dapat diperbarui. Silakan muat ulang halaman.');
    }
  }

  async function handleAdminSave(event) {
    event.preventDefault();
    if ((!product && !catalogFallback) || sessionUser?.role !== 'admin') return;
    setAdminBusy(true);
    setAdminError('');
    setAdminNotice('');
    try {
      const payload = {
        name: adminForm.name,
        slug: adminForm.slug || product.slug,
        category: adminForm.category,
        description: adminForm.description,
        longDescription: adminForm.longDescription,
        harvestDuration: adminForm.harvestDuration,
        highlights: adminForm.highlights.split('\n').map((line) => line.trim()).filter(Boolean),
        gallery: adminForm.gallery.split('\n').map((line) => line.trim()).filter(Boolean),
        price: Number(adminForm.price),
        satuan: adminForm.satuan,
        origin: adminForm.origin,
        imageUrl: adminForm.imageUrl,
      };
      const creating = !product;
      const response = await fetch(creating ? '/api/products' : `/api/products/${encodeURIComponent(product.slug)}`, {
        method: creating ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (creating ? 'Pendaftaran produk gagal.' : 'Update produk gagal.'));
      setAdminNotice(creating ? 'Produk berhasil didaftarkan.' : 'Produk berhasil diperbarui.');
      setProduct({
        ...data.product,
        highlights: payload.highlights,
        gallery: payload.gallery,
      });
      setCatalogFallback(null);
      if (data.product.slug !== slug) router.replace(`/products/${encodeURIComponent(data.product.slug)}`);
    } catch (cause) {
      setAdminError(cause.message || 'Update produk gagal.');
    } finally {
      setAdminBusy(false);
    }
  }

  async function handleAdminDelete() {
    if (!product || !sessionUser || sessionUser.role !== 'admin') return;
    const confirmed = window.confirm('Nonaktifkan produk ini dari katalog?');
    if (!confirmed) return;
    setAdminBusy(true);
    setAdminError('');
    setAdminNotice('');
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.slug)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Produk gagal dinonaktifkan.');
      setAdminNotice('Produk berhasil dinonaktifkan dari katalog.');
      router.replace('/admin');
    } catch (cause) {
      setAdminError(cause.message || 'Produk gagal dinonaktifkan.');
    } finally {
      setAdminBusy(false);
    }
  }

  if (error) return <main className={`${styles.page} commerce-surface`}><Link href="/" className={styles.back}>← Kembali ke katalog</Link><p className={styles.feedback}>{error}</p></main>;
  if (!product && !catalogFallback) return <main className={`${styles.page} commerce-surface`}><p>Memuat detail produk…</p></main>;
  const displayedProduct = product || catalogFallback;
  const unit = displayedProduct.satuan || 'unit';
  const packaging = quantity <= 10
    ? { image: 'small pouch packaging.png', label: 'Kemasan pouch kecil' }
    : quantity <= 50
      ? { image: 'medium box packaging.png', label: 'Kemasan kotak sedang' }
      : { image: 'large gunny sack packaging.png', label: 'Kemasan karung besar' };
  const estimatedSubtotal = product ? Number(product.price) * quantity : 0;
  const provinceOptions = uniqueValues(regions.map(regionProvince));
  const provinceRegions = regions.filter((region) => !regionSelection.province || regionProvince(region) === regionSelection.province);
  const cityOptions = uniqueValues(provinceRegions.map(regionCity));
  const cityRegions = provinceRegions.filter((region) => !regionSelection.city || regionCity(region) === regionSelection.city);
  const districtOptions = uniqueValues(cityRegions.map(regionDistrict));
  const districtRegions = cityRegions.filter((region) => !regionSelection.district || regionDistrict(region) === regionSelection.district);
  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length : 0;

  return (
    <main className={`${styles.page} commerce-surface ${sessionUser?.role === 'admin' ? styles.adminPage : ''}`}>
      <Link href="/" className={styles.back}>← Kembali ke katalog</Link>
      {sessionUser?.role === 'admin' && <div className={styles.adminBanner}>MODE ADMIN · Anda dapat mengelola produk dari halaman ini</div>}
      <section className={styles.product}>
        <div className={styles.gallery}>
          <div className={styles.image}>
            {(gallery[galleryIndex] || displayedProduct.image_url) && <img src={gallery[galleryIndex] || displayedProduct.image_url} alt={`${displayedProduct.name} - foto ${galleryIndex + 1}`} />}
            {gallery.length > 1 && <>
              <button type="button" className={`${styles.galleryArrow} ${styles.previous}`} onClick={() => setGalleryIndex((galleryIndex + gallery.length - 1) % gallery.length)} aria-label="Foto sebelumnya">‹</button>
              <button type="button" className={`${styles.galleryArrow} ${styles.next}`} onClick={() => setGalleryIndex((galleryIndex + 1) % gallery.length)} aria-label="Foto berikutnya">›</button>
              <div className={styles.galleryDots}>{gallery.map((image, index) => <button key={`${image}-${index}`} type="button" className={index === galleryIndex ? styles.activeDot : ''} onClick={() => setGalleryIndex(index)} aria-label={`Tampilkan foto ${index + 1}`} />)}</div>
            </>}
          </div>
          {gallery.length > 1 && <div className={styles.thumbnails}>{gallery.map((image, index) => <button key={`${image}-thumb`} className={index === galleryIndex ? styles.selectedThumbnail : ''} type="button" onClick={() => setGalleryIndex(index)} aria-label={`Pilih foto ${index + 1}`}><img src={image} alt="" /></button>)}</div>}
        </div>
        <div className={styles.details}>
          <span className={styles.eyebrow}>KATALOG SUPLIER</span>
          <h1>{displayedProduct.name}</h1>
          <p className={styles.price}>{product ? format(product.price) : 'Harga belum tersedia'} <span>/ {unit}</span></p>
          <p className={styles.description}>{displayedProduct.description || 'Deskripsi singkat belum ditambahkan.'}</p>
          {product?.harvest_duration || displayedProduct.harvest_duration ? (
            <p className={styles.harvest}>Lama panen/produksi: {product?.harvest_duration || displayedProduct.harvest_duration}</p>
          ) : null}
          <dl>
            <div><dt>Stok tersedia</dt><dd>{displayedProduct.stock} {unit}</dd></div>
            <div><dt>Asal budidaya</dt><dd>{displayedProduct.origin || 'Belum ditentukan'}</dd></div>
            <div><dt>Jenis</dt><dd>{displayedProduct.category || 'Rempah'}</dd></div>
          </dl>
          {!product && <p className={styles.feedback}>Produk katalog contoh. Suplier perlu mendaftarkan produk ini agar bisa dipesan.</p>}
          {sessionUser?.role !== 'admin' && product && product.stock > 0 ? <div className={styles.actions}>
            <button type="button" onClick={() => { setQuantity(1); setModalAction('cart'); }}>Keranjang</button>
            <button type="button" onClick={() => { setQuantity(1); setModalAction('buy'); }}>Beli sekarang</button>
          </div> : sessionUser?.role !== 'admin' && product ? <p className={styles.feedback}>Stok sedang habis.</p> : null}
          {notice && <p className={styles.feedback} role="status">{notice}</p>}
        </div>
      </section>

      {sessionUser?.role === 'admin' && (product || catalogFallback) && (
            <form className={styles.adminPanel} onSubmit={handleAdminSave}>
              <h2>{product ? 'Kelola produk' : 'Daftarkan produk ini'}</h2>
              <p>{product ? 'Perubahan yang disimpan akan langsung diterapkan pada katalog.' : 'Lengkapi harga, stok, dan informasi produk agar item katalog ini dapat dipesan.'}</p>
              <div className={styles.adminGrid}>
                <label>Nama<input required minLength={2} maxLength={200} value={adminForm.name} onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={adminForm.slug} onChange={(event) => setAdminForm((current) => ({ ...current, slug: event.target.value }))} /></label>
                <label>Kategori<input required maxLength={120} value={adminForm.category} onChange={(event) => setAdminForm((current) => ({ ...current, category: event.target.value }))} /></label>
                <label>Harga<input required type="number" min="0" step="1" value={adminForm.price} onChange={(event) => setAdminForm((current) => ({ ...current, price: event.target.value }))} /></label>
                <label>Total stok semua gudang<input required type="number" min="0" step="1" value={adminForm.stock} readOnly /><small>Kelola stok per lokasi melalui menu Gudang di portal suplier.</small></label>
                <label>Satuan<input required maxLength={40} value={adminForm.satuan} onChange={(event) => setAdminForm((current) => ({ ...current, satuan: event.target.value }))} /></label>
                <label>Asal<input value={adminForm.origin} onChange={(event) => setAdminForm((current) => ({ ...current, origin: event.target.value }))} /></label>
                <label>Lama panen / produksi<input value={adminForm.harvestDuration} onChange={(event) => setAdminForm((current) => ({ ...current, harvestDuration: event.target.value }))} /></label>
                <label className={styles.fullField}>Gambar utama<input value={adminForm.imageUrl} onChange={(event) => setAdminForm((current) => ({ ...current, imageUrl: event.target.value }))} /></label>
                <label className={styles.fullField}>Deskripsi singkat<textarea value={adminForm.description} onChange={(event) => setAdminForm((current) => ({ ...current, description: event.target.value }))} rows={3} /></label>
                <label className={styles.fullField}>Detail produk<textarea value={adminForm.longDescription} onChange={(event) => setAdminForm((current) => ({ ...current, longDescription: event.target.value }))} rows={4} /></label>
                <label className={styles.fullField}>Poin unggulan (satu per baris)<textarea value={adminForm.highlights} onChange={(event) => setAdminForm((current) => ({ ...current, highlights: event.target.value }))} rows={4} /></label>
                <label className={styles.fullField}>Galeri URL (satu per baris)<textarea value={adminForm.gallery} onChange={(event) => setAdminForm((current) => ({ ...current, gallery: event.target.value }))} rows={4} /></label>
              </div>
              {adminError && <p className={styles.feedback} role="alert">{adminError}</p>}
              {adminNotice && <p className={styles.feedback} role="status">{adminNotice}</p>}
              <div className={styles.adminActions}>
                <button type="submit" disabled={adminBusy}>{product ? 'Simpan perubahan' : 'Daftarkan produk'}</button>
                {product && <button type="button" className={styles.deleteButton} disabled={adminBusy} onClick={handleAdminDelete}>Hapus dari katalog</button>}
              </div>
            </form>
      )}

      <section className={styles.story}>
        <div className={styles.storyCopy}><span className={styles.eyebrow}>CERITA PRODUK</span><h2>Kenali lebih dekat</h2><p>{product?.long_description || displayedProduct.description || 'Detail produk akan dilengkapi oleh suplier.'}</p></div>
        {product?.highlights?.length > 0 && <ul className={styles.highlights}>{product.highlights.map((highlight, index) => <li key={`${highlight}-${index}`}>{highlight}</li>)}</ul>}
      </section>

      <section className={styles.reviews}>
        <header><div><span className={styles.eyebrow}>PENGALAMAN PELANGGAN</span><h2>Ulasan produk</h2></div><div className={styles.ratingSummary}><strong>{averageRating ? averageRating.toFixed(1) : '—'}</strong><span aria-label={`${averageRating.toFixed(1)} dari 6 bintang`}>{'★'.repeat(Math.round(averageRating))}{'☆'.repeat(6 - Math.round(averageRating))}</span><small>{reviews.length} ulasan pesanan selesai</small></div></header>
        {reviews.length ? <div className={styles.reviewList}>{reviews.map((review) => <article className={styles.review} key={review.id}><div><strong>{review.full_name}</strong><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</time></div><span className={styles.reviewStars} aria-label={`${review.rating} dari 6 bintang`}>{'★'.repeat(Number(review.rating))}{'☆'.repeat(6 - Number(review.rating))}</span><p>{review.body || 'Pelanggan belum menambahkan detail ulasan.'}</p></article>)}</div> : <p className={styles.emptyReviews}>Belum ada ulasan dari pesanan yang selesai.</p>}
      </section>

      {modalAction && product && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setModalAction(''); }}>
        <section className={styles.orderModal} role="dialog" aria-modal="true" aria-labelledby="order-confirm-title">
          <button type="button" className={styles.closeModal} onClick={() => setModalAction('')} aria-label="Tutup konfirmasi">×</button>
          <span className={styles.eyebrow}>KONFIRMASI PESANAN</span><h2 id="order-confirm-title">Atur jumlah produk</h2>
          <div className={styles.modalProduct}>{product.image_url && <img src={product.image_url} alt={product.name} />}<div><strong>{product.name}</strong><span>{format(product.price)} / {unit}</span><small>Tersedia {product.stock} {unit}</small></div></div>
          <div className={styles.quantityBlock}>
            <label className={styles.quantity} htmlFor="order-quantity">Jumlah pesanan <span>{unit}</span></label>
            <div className={styles.quantityStepper}>
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} aria-label="Kurangi jumlah">−</button>
              <input id="order-quantity" type="number" min="1" max={product.stock} value={quantity} onChange={(event) => setQuantity(Math.min(product.stock, Math.max(1, Number(event.target.value) || 1)))} />
              <button type="button" onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} disabled={quantity >= product.stock} aria-label="Tambah jumlah">+</button>
            </div>
          </div>
          <div className={styles.packaging}><img src={`/Pictures/asset/${encodeURIComponent(packaging.image)}`} alt="" /><div><span>Informasi kemasan</span><strong>{packaging.label}</strong><small>Disesuaikan otomatis berdasarkan jumlah pesanan.</small></div></div>
          <div className={styles.modalTotal}><span>Subtotal produk, belum termasuk ongkir</span><strong>{format(estimatedSubtotal)}</strong></div>
          <div className={styles.shippingDestination}>
            <div><strong>Estimasi lokasi pengiriman</strong><small>Provinsi, kabupaten/kota, dan kecamatan</small></div>
            <div className={styles.regionSearch}>
              <input value={regionSearch} onChange={(event) => setRegionSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); searchShippingRegions(); } }} placeholder="Cari wilayah tujuan" aria-label="Cari wilayah tujuan" />
              <button type="button" onClick={searchShippingRegions}>Cari</button>
            </div>
            {regions.length > 0 && <div className={styles.regionFields}>
              <label>Provinsi<select value={regionSelection.province} onChange={(event) => chooseShippingRegion('province', event.target.value)}><option value="">Pilih provinsi</option>{provinceOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label>Kabupaten / kota<select value={regionSelection.city} disabled={!regionSelection.province} onChange={(event) => chooseShippingRegion('city', event.target.value)}><option value="">Pilih kabupaten/kota</option>{cityOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label>Kecamatan<select value={regionSelection.district} disabled={!regionSelection.city} onChange={(event) => chooseShippingRegion('district', event.target.value)}><option value="">Pilih kecamatan</option>{districtOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label>Kelurahan / desa<select value={regionSelection.areaId} disabled={!regionSelection.district} onChange={(event) => chooseShippingRegion('areaId', event.target.value)}><option value="">Pilih kelurahan/desa</option>{districtRegions.map((region) => <option key={region.area_id} value={region.area_id}>{regionArea(region)} · {region.zipcode}</option>)}</select></label>
            </div>}
          </div>
          <div className={styles.shippingEstimate} aria-live="polite"><div><strong>Estimasi ongkir</strong><span>Terpisah dari total belanja · {quantity > 30 ? 'khusus Cargo' : 'semua layanan'}</span></div>{shippingQuotes.length ? <p><span>{shippingQuotes[0].courierName} {shippingQuotes[0].serviceName} · {format(shippingQuotes[0].buyer.buyerPays)}</span><span>{shippingQuotes.at(-1).courierName} {shippingQuotes.at(-1).serviceName} · {format(shippingQuotes.at(-1).buyer.buyerPays)}</span></p> : <small>{shippingEstimateStatus || 'Pilih alamat utama untuk menghitung ongkir.'}</small>}</div>
          <div className={styles.modalActions}><button type="button" className={styles.cancelModal} onClick={() => setModalAction('')}>Kembali</button><button type="button" className={styles.confirmModal} onClick={confirmOrder}>{modalAction === 'buy' ? 'Lanjut checkout' : 'Masukkan keranjang'}</button></div>
        </section>
      </div>}
    </main>
  );
}
