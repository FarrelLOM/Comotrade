'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { animate, stagger } from 'animejs';
import { useCurrency } from '@/app/components/CurrencyProvider';
import styles from './dashboard.module.css';

const DeliveryMap = dynamic(() => import('@/app/checkout/DeliveryMap'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Memuat peta…</div>,
});

function formatProductList(value) {
  if (Array.isArray(value)) return value.join('\n');
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.join('\n') : '';
  } catch {
    return '';
  }
}

function makeProductSlug(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function Dashboard({ adminOnly = false, section = 'orders' }) {
  const { format } = useCurrency();
  const [adminSection, setAdminSection] = useState('products');
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseInventory, setWarehouseInventory] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [warehouseCoordinate, setWarehouseCoordinate] = useState('');
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [warehouseRegion, setWarehouseRegion] = useState({
    areaName: '', districtName: '', cityName: '', provinceName: '', zipcode: '',
  });
  const [productToAssign, setProductToAssign] = useState('');
  const [customers, setCustomers] = useState([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [walletCustomerId, setWalletCustomerId] = useState('');
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [message, setMessage] = useState('');
  const [resolutionAwbs, setResolutionAwbs] = useState({});

  async function load() {
    const needsOrders = adminOnly || section === 'orders';
    const needsMessages = adminOnly || section === 'messages';
    const [meResponse, ordersResponse, messagesResponse, productsResponse, customersResponse, warehousesResponse] = await Promise.all([
      fetch('/api/auth/me'),
      needsOrders ? fetch('/api/orders') : Promise.resolve(null),
      needsMessages ? fetch('/api/messages') : Promise.resolve(null),
      adminOnly ? fetch('/api/products') : Promise.resolve(null),
      adminOnly ? fetch('/api/admin/users') : Promise.resolve(null),
      adminOnly ? fetch('/api/admin/warehouses') : Promise.resolve(null),
    ]);
    const me = await meResponse.json();
    if (!meResponse.ok || !me.user) throw new Error(me.error || 'Silakan login terlebih dahulu.');
    if (adminOnly && me.user.role !== 'admin') throw new Error('Halaman ini khusus administrator.');
    const orderData = ordersResponse ? await ordersResponse.json() : { orders: [] };
    const messageData = messagesResponse ? await messagesResponse.json() : { conversations: [] };
    const productData = productsResponse ? await productsResponse.json() : { products: [] };
    const customerData = customersResponse ? await customersResponse.json() : { users: [] };
    const warehouseData = warehousesResponse ? await warehousesResponse.json() : { warehouses: [], inventory: [] };
    setUser(me.user);
    if (ordersResponse && !ordersResponse.ok) throw new Error(orderData.error || 'Pesanan gagal dimuat.');
    if (messagesResponse && !messagesResponse.ok) throw new Error(messageData.error || 'Pesan gagal dimuat.');
    if (warehousesResponse && !warehousesResponse.ok) throw new Error(warehouseData.error || 'Gudang gagal dimuat.');
    setOrders(orderData.orders || []);
    setConversations(messageData.conversations || []);
    setProducts(adminOnly ? (productData.products || []) : []);
    setCustomers(customerData.users || []);
    setWarehouses(adminOnly ? (warehouseData.warehouses || []) : []);
    setWarehouseInventory(adminOnly ? (warehouseData.inventory || []) : []);
    setSelectedWarehouseId((current) => current || warehouseData.warehouses?.find((warehouse) => warehouse.is_default)?.id || warehouseData.warehouses?.[0]?.id || '');
  }

  useEffect(() => { load().catch((cause) => setError(cause.message)); }, [adminOnly, section]);
  useEffect(() => {
    const warehouse = warehouses.find((item) => item.id === selectedWarehouseId);
    setWarehouseCoordinate(warehouse?.coordinate || '');
    setWarehouseAddress(warehouse?.address_line || '');
    setWarehouseRegion({
      areaName: warehouse?.area_name || '',
      districtName: warehouse?.district_name || '',
      cityName: warehouse?.city_name || '',
      provinceName: warehouse?.province_name || '',
      zipcode: warehouse?.zipcode || '',
    });
  }, [selectedWarehouseId, warehouses]);
  useEffect(() => {
    if (!adminOnly || !user || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const panels = document.querySelectorAll(`.${styles.panel}`);
    if (!panels.length) return;
    const animation = animate(panels, {
      opacity: [0, 1],
      translateY: [14, 0],
      delay: stagger(65),
      duration: 460,
      ease: 'outCubic',
    });
    return () => animation.revert();
  }, [adminOnly, adminSection, user]);

  async function send(path, body, method = 'POST') {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Permintaan gagal.');
      setNotice('Perubahan berhasil disimpan.');
      await load();
      return data;
    } catch (cause) { setError(cause.message); return null; }
    finally { setBusy(false); }
  }

  async function uploadProductMedia(files, folder = 'comotrade/products') {
    const uploaded = [];
    for (const file of Array.from(files || [])) {
      if (!(file instanceof File) || file.size === 0) continue;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const response = await fetch('/api/uploads/cloudinary', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Upload media produk gagal.');
      uploaded.push(payload.url);
    }
    return uploaded;
  }

  async function logout() {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) {
      setError('Tidak dapat keluar dari akun. Coba lagi.');
      return;
    }
    location.assign('/');
  }

  async function startPayment(orderId) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/orders/${orderId}/payment`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Instruksi pembayaran belum dapat dibuat.');
      if (!data.payment?.payment_url) throw new Error('URL pembayaran dari Tripay tidak tersedia.');
      location.assign(data.payment.payment_url);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function createProduct(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const localImage = form.get('localImage');
    const localGalleryValues = form.getAll('localGallery');
    try {
      setBusy(true);
      if (!(localImage instanceof File) || localImage.size === 0) {
        setError('Pilih foto utama produk sebelum menyimpan.');
        return;
      }
      const uploaded = await uploadProductMedia([localImage]);
      const uploadedGallery = await uploadProductMedia(localGalleryValues);

      const result = await send('/api/products', {
        name: form.get('name'), slug: String(form.get('slug') || '').trim() || makeProductSlug(form.get('name')), category: form.get('category'),
        description: form.get('description'), longDescription: form.get('longDescription'), harvestDuration: form.get('harvestDuration'),
        highlights: form.get('highlights'), gallery: uploadedGallery,
        price: form.get('price'), stock: form.get('stock'), satuan: form.get('satuan'),
            shippingWeightGram: form.get('shippingWeightGram'), shippingLengthCm: form.get('shippingLengthCm'),
            shippingWidthCm: form.get('shippingWidthCm'), shippingHeightCm: form.get('shippingHeightCm'),
            origin: form.get('origin'), imageUrl: uploaded[0], warehouseId: selectedWarehouseId,
      });
      if (result) formElement.reset();
    } catch (cause) {
      setError(cause.message || 'Produk belum dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }

  async function createShipment(orderId) {
    await send(`/api/orders/${orderId}/shipment`, {});
  }

  async function cancelShipment(orderId) {
    await send(`/api/orders/${orderId}/shipment`, { reason: 'Dibatalkan oleh admin' }, 'DELETE');
  }

  async function resolveShipment(orderId) {
    await send(`/api/orders/${orderId}/shipment`, { awb: resolutionAwbs[orderId] || '' }, 'PATCH');
  }

  async function reconcileShipments() {
    await send('/api/shipping/reconcile', { olderThanMinutes: 60 });
  }

  async function adjustWallet(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await send('/api/admin/wallet', {
      userId: walletCustomerId,
      amount: form.get('amount'),
      direction: form.get('direction'),
      description: form.get('description'),
    });
    formElement.reset();
  }

  async function saveWarehouse(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const warehouseId = selectedWarehouseId;
    const coordinateParts = warehouseCoordinate.split(',').map((part) => Number(part.trim()));
    if (coordinateParts.length !== 2 || coordinateParts.some((part) => !Number.isFinite(part)) ||
        Math.abs(coordinateParts[0]) > 90 || Math.abs(coordinateParts[1]) > 180) {
      setError('Pilih titik lokasi gudang pada peta sebelum menyimpan.');
      return;
    }
    const data = Object.fromEntries(form.entries());
    data.isDefault = form.has('isDefault');
    data.isActive = warehouseId ? form.has('isActive') : true;
    data.coordinate = warehouseCoordinate;
    data.addressLine = warehouseAddress;
    const result = await send(
      warehouseId ? `/api/admin/warehouses/${warehouseId}` : '/api/admin/warehouses',
      data,
      warehouseId ? 'PATCH' : 'POST',
    );
    if (!result) return;
    setSelectedWarehouseId(result.warehouse.id);
    setNotice(warehouseId ? 'Data gudang diperbarui.' : 'Gudang baru berhasil dibuat.');
  }

  function locateWarehouse() {
    if (!navigator.geolocation) {
      setError('Browser ini tidak mendukung deteksi lokasi. Pilih titik langsung pada peta.');
      return;
    }
    setBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setWarehouseCoordinate(`${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`);
        setNotice('Titik lokasi berhasil dipilih. Pastikan pin sudah tepat pada peta.');
        setBusy(false);
      },
      () => {
        setError('Lokasi tidak dapat diakses. Izinkan akses lokasi atau pilih titik langsung pada peta.');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function saveWarehouseInventory(event) {
    event.preventDefault();
    if (!selectedWarehouseId) return;
    const form = new FormData(event.currentTarget);
    const inventory = warehouseProducts.map((product) => ({
      productId: product.id,
      stock: Number(form.get(`stock-${product.id}`) || 0),
    }));
    await send(`/api/admin/warehouses/${selectedWarehouseId}/inventory`, { products: inventory }, 'PUT');
  }

  async function addProductToWarehouse(event) {
    event.preventDefault();
    if (!selectedWarehouseId || !productToAssign) return;
    const result = await send(`/api/admin/warehouses/${selectedWarehouseId}/inventory`, {
      products: [{ productId: productToAssign, stock: 0 }],
    }, 'PUT');
    if (result) setProductToAssign('');
  }

  async function resolveWarehouseAddress() {
    const [latitude, longitude] = warehouseCoordinate.split(',').map((part) => Number(part.trim()));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Pilih titik lokasi pada peta terlebih dahulu.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/shipping/geocode?lat=${latitude}&lon=${longitude}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Alamat dari peta belum dapat ditemukan.');
      const address = data.address || {};
      setWarehouseAddress(String(data.displayName || '').slice(0, 1000));
      setWarehouseRegion((current) => ({
        ...current,
        areaName: address.suburb || address.village || address.neighbourhood || current.areaName,
        districtName: address.city_district || address.district || address.county || current.districtName,
        cityName: address.city || address.town || address.municipality || current.cityName,
        provinceName: address.state || current.provinceName,
        zipcode: address.postcode || current.zipcode,
      }));
      setNotice('Alamat dari pin peta berhasil diisi. Periksa Area ID Jubelio sebelum menyimpan.');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivateWarehouse() {
    if (!selectedWarehouseId || !window.confirm('Nonaktifkan gudang ini? Riwayat pesanan tetap disimpan.')) return;
    await send(`/api/admin/warehouses/${selectedWarehouseId}`, {}, 'DELETE');
    setSelectedWarehouseId('');
  }

  async function updateProduct(event, product) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const localImage = form.get('localImage');
    const localGalleryValues = form.getAll('localGallery');

    try {
      setBusy(true);
      const changes = {
        name: form.get('name'), slug: form.get('slug'), category: form.get('category'),
        description: form.get('description'), longDescription: form.get('longDescription'), harvestDuration: form.get('harvestDuration'),
        highlights: form.get('highlights'),
        price: form.get('price'), satuan: form.get('satuan'),
        shippingWeightGram: form.get('shippingWeightGram'), shippingLengthCm: form.get('shippingLengthCm'),
        shippingWidthCm: form.get('shippingWidthCm'), shippingHeightCm: form.get('shippingHeightCm'),
        origin: form.get('origin'),
      };
      if (localImage instanceof File && localImage.size > 0) {
        const uploaded = await uploadProductMedia([localImage]);
        changes.imageUrl = uploaded[0];
      }
      const uploadedGallery = await uploadProductMedia(localGalleryValues);
      if (uploadedGallery.length) {
        const existingGallery = formatProductList(product.gallery_json).split('\n').filter(Boolean);
        changes.gallery = [...existingGallery, ...uploadedGallery].slice(0, 12);
      }
      await send(`/api/products/${encodeURIComponent(product.slug)}`, changes, 'PATCH');
    } catch (cause) {
      setError(cause.message || 'Produk belum dapat diperbarui.');
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    if (!message.trim()) return;
    const conversationId = selectedConversation || undefined;
    const data = await send('/api/messages', {
      conversationId,
      orderId: selectedOrderId || undefined,
      body: message,
    });
    if (data) {
      setMessage('');
      setSelectedConversation(data.message.conversation_id);
      setSelectedOrderId('');
    }
  }

  async function submitReview(event, itemId) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await send('/api/reviews', { orderItemId: itemId, rating: form.get('rating'), body: form.get('body') });
    formElement.reset();
  }

  if (error && !user) return <main className={`${styles.page} commerce-surface`}><Link className={styles.secondary} href="/">← Katalog</Link><section className={styles.panel}><h1>{adminOnly ? 'Portal suplier' : 'Akun marketplace'}</h1><p>{error}</p><Link className={styles.button} href="/login">Login</Link></section></main>;

  const adminSectionLabels = {
    products: 'Produk',
    warehouses: 'Gudang',
    orders: 'Pesanan',
    messages: 'Pesan',
    customers: 'Pelanggan & wallet',
  };
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId);
  const selectedWarehouseInventory = new Map(warehouseInventory
    .filter((entry) => entry.warehouse_id === selectedWarehouseId)
    .map((entry) => [entry.product_id, entry.stock]));
  const warehouseProducts = products.filter((product) => selectedWarehouseInventory.has(product.id));
  const unassignedProducts = products.filter((product) => !selectedWarehouseInventory.has(product.id));
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.is_active);

  return (
    <main className={`${styles.page} commerce-surface`}>
      <header className={styles.header}><div><Link href="/" className={styles.brand}>REMPAH NUSANTARA</Link><h1>{adminOnly ? adminSection === 'products' ? 'Kelola produk' : adminSection === 'warehouses' ? 'Kelola gudang' : adminSection === 'orders' ? 'Kelola pesanan' : adminSection === 'messages' ? 'Inbox pesan' : 'Data pelanggan' : section === 'messages' ? 'Pesan' : 'Pesanan'}</h1><p>{user?.full_name} · {adminOnly ? 'Portal suplier' : 'Ruang pelanggan'}</p></div><div className={styles.headerActions}>{!adminOnly && <Link className={styles.button} href="/account">Ringkasan akun</Link>}<Link className={styles.secondary} href="/cart"><img className={styles.actionIcon} src="/Pictures/asset/cart%20icon.png" alt="" />Keranjang</Link><button className={styles.dangerButton} onClick={logout}>Keluar dari akun</button></div></header>
      {adminOnly && <section className={styles.adminWelcome}><span>RUANG PENGELOLA REMPAH NUSANTARA</span><h2>Selamat datang, {user?.full_name?.split(' ')[0] || 'Admin'}</h2><p>Kelola produk, lokasi gudang, pesanan, dan pelanggan dalam satu tempat.</p></section>}
      {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
      {!adminOnly && <nav className={styles.accountNav} aria-label="Menu akun"><Link href="/account/profile">Profil</Link><Link href="/account/addresses">Alamat</Link><Link href="/account/wallet">Wallet</Link><Link href="/account/orders">Pesanan</Link><Link href="/account/messages">Pesan</Link></nav>}
      {adminOnly && user?.role === 'admin' && <nav className={styles.accountNav} aria-label="Menu portal suplier">{Object.entries(adminSectionLabels).map(([key, label]) => <button type="button" className={adminSection === key ? styles.activeTab : ''} aria-current={adminSection === key ? 'page' : undefined} key={key} onClick={() => setAdminSection(key)}>{label}</button>)}</nav>}

      {adminOnly && adminSection === 'warehouses' && user?.role === 'admin' && (() => {
        return <section className={styles.panel}>
          <div className={styles.panelToolbar}><div><span className={styles.sectionEyebrow}>PENGELOLAAN LOKASI</span><h2>Gudang & stok</h2><p className={styles.panelHint}>Atur alamat asal kiriman dan jumlah stok di setiap lokasi.</p></div><button type="button" className={styles.button} onClick={() => setSelectedWarehouseId('')}>＋ Tambah gudang</button></div>
          <div className={styles.warehouseLayout}>
            <aside className={styles.warehouseSidebar}><strong>Lokasi tersimpan <span>{warehouses.length}</span></strong>
              {warehouses.length ? warehouses.map((warehouse) => <button type="button" key={warehouse.id} className={`${styles.warehouseOption} ${selectedWarehouseId === warehouse.id ? styles.warehouseOptionActive : ''}`} onClick={() => setSelectedWarehouseId(warehouse.id)}><span><b>{warehouse.name}</b><small>{warehouse.city_name || warehouse.address_line}</small></span><i className={warehouse.is_active ? styles.statusActive : styles.statusInactive}>{warehouse.is_active ? 'Aktif' : 'Nonaktif'}</i></button>) : <p className={styles.emptyHint}>Belum ada gudang. Tambahkan lokasi pertama.</p>}
            </aside>
            <div className={styles.warehouseEditor}>
              <form className={styles.productForm} key={selectedWarehouseId || 'new-warehouse'} onSubmit={saveWarehouse}>
                <div className={styles.formSectionTitle}><span>{selectedWarehouse ? 'UBAH LOKASI' : 'LOKASI BARU'}</span><strong>{selectedWarehouse ? selectedWarehouse.name : 'Informasi gudang'}</strong></div>
                <label>Nama gudang<input name="name" defaultValue={selectedWarehouse?.name || ''} maxLength="160" placeholder="Contoh: Gudang Bandung" required /></label>
                <label>Nomor telepon<input name="phone" type="tel" defaultValue={selectedWarehouse?.phone || ''} maxLength="30" placeholder="08xx xxxx xxxx" required /></label>
                <label>Area ID Jubelio<input name="areaId" defaultValue={selectedWarehouse?.area_id || ''} inputMode="numeric" pattern="[0-9]{10}" maxLength="10" placeholder="10 digit ID" required /></label>
                <label>Kode pos<input name="zipcode" value={warehouseRegion.zipcode} onChange={(event) => setWarehouseRegion((current) => ({ ...current, zipcode: event.target.value }))} inputMode="numeric" pattern="[0-9]{4,10}" maxLength="10" placeholder="Contoh: 40111" required /></label>
                <label className={styles.full}>Alamat singkat<textarea value={warehouseAddress} onChange={(event) => setWarehouseAddress(event.target.value)} maxLength="1000" rows="2" placeholder="Nama jalan, nomor, patokan atau area sekitar" required /></label>
                <div className={`${styles.mapPanel} ${styles.full}`}><div className={styles.mapHeading}><div><strong>Titik lokasi gudang</strong><small>{warehouseCoordinate || 'Klik peta untuk memasang pin lokasi.'}</small></div><div className={styles.mapActions}><button type="button" className={styles.secondary} disabled={busy} onClick={locateWarehouse}>◎ Gunakan lokasi saya</button><button type="button" className={styles.secondary} disabled={busy || !warehouseCoordinate} onClick={resolveWarehouseAddress}>Isi alamat dari pin</button></div></div><DeliveryMap coordinate={warehouseCoordinate} onChange={setWarehouseCoordinate} /><input type="hidden" name="coordinate" value={warehouseCoordinate} />{!warehouseCoordinate && <span className={styles.mapHelp}>Klik titik lokasi gudang pada peta. Pin juga dapat digeser.</span>}</div>
                <details className={`${styles.formDisclosure} ${styles.full}`}><summary>Data tambahan <span>Wilayah, catatan, pengaturan</span></summary><div className={styles.formSubgrid}>
                  <label>Kelurahan / desa<input name="areaName" value={warehouseRegion.areaName} onChange={(event) => setWarehouseRegion((current) => ({ ...current, areaName: event.target.value }))} maxLength="200" /></label>
                  <label>Kecamatan<input name="districtName" value={warehouseRegion.districtName} onChange={(event) => setWarehouseRegion((current) => ({ ...current, districtName: event.target.value }))} maxLength="200" /></label>
                  <label>Kota / kabupaten<input name="cityName" value={warehouseRegion.cityName} onChange={(event) => setWarehouseRegion((current) => ({ ...current, cityName: event.target.value }))} maxLength="200" /></label>
                  <label>Provinsi<input name="provinceName" value={warehouseRegion.provinceName} onChange={(event) => setWarehouseRegion((current) => ({ ...current, provinceName: event.target.value }))} maxLength="200" /></label>
                  <label className={styles.full}>Catatan gudang<textarea name="description" defaultValue={selectedWarehouse?.description || ''} maxLength="4000" rows="2" /></label>
                  <label className={styles.checkboxField}><input name="isDefault" type="checkbox" defaultChecked={Boolean(selectedWarehouse?.is_default)} /> Jadikan lokasi utama</label>
                  {selectedWarehouse && <label className={styles.checkboxField}><input name="isActive" type="checkbox" defaultChecked={Boolean(selectedWarehouse.is_active)} /> Aktif untuk checkout</label>}
                </div></details>
                <div className={styles.warehouseActions}><button className={styles.button} disabled={busy}>{busy ? 'Menyimpan…' : selectedWarehouse ? 'Simpan perubahan' : '＋ Simpan gudang'}</button>{selectedWarehouse && selectedWarehouse.is_active && !selectedWarehouse.is_default && <button type="button" className={styles.dangerButton} disabled={busy} onClick={deactivateWarehouse}>Nonaktifkan</button>}</div>
              </form>
              {selectedWarehouse?.is_active && <section className={styles.inventoryForm}>
                <div><h3>Produk di {selectedWarehouse.name}</h3><p className={styles.panelHint}>Hanya produk yang ditautkan ke gudang ini yang ditampilkan.</p></div>
                {unassignedProducts.length > 0 && <form className={styles.attachProduct} onSubmit={addProductToWarehouse}><label>Tambahkan produk yang sudah ada<select value={productToAssign} onChange={(event) => setProductToAssign(event.target.value)} required><option value="">Pilih produk…</option>{unassignedProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><button className={styles.secondary} disabled={busy || !productToAssign}>＋ Tambahkan produk</button></form>}
                {warehouseProducts.length ? <form onSubmit={saveWarehouseInventory}><div className={styles.inventoryList}>{warehouseProducts.map((product) => <label key={product.id}><span><strong>{product.name}</strong><small>Total semua gudang: {product.stock} {product.satuan || 'unit'}</small></span><input name={`stock-${product.id}`} type="number" min="0" max="2147483647" step="1" defaultValue={selectedWarehouseInventory.get(product.id) ?? 0} aria-label={`Stok ${product.name} di ${selectedWarehouse.name}`} /></label>)}</div><button className={styles.button} disabled={busy}>Simpan stok</button></form> : <p>Belum ada produk di gudang ini. Tambahkan produk baru atau tautkan produk yang sudah ada.</p>}
              </section>}
            </div>
          </div>
        </section>;
      })()}

      {adminOnly && adminSection === 'products' && user?.role === 'admin' && <section className={styles.panel}><div className={styles.panelToolbar}><div><span className={styles.sectionEyebrow}>KATALOG TOKO</span><h2>Tambah produk</h2><p className={styles.panelHint}>Produk akan tercatat di gudang terpilih. Nama otomatis menjadi alamat halaman.</p></div></div>
        <label className={styles.warehouseSelect}>Masukkan produk ke gudang<select value={selectedWarehouseId} onChange={(event) => setSelectedWarehouseId(event.target.value)}><option value="">Pilih gudang…</option>{activeWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.is_default ? ' · Utama' : ''}</option>)}</select></label>
        {!activeWarehouses.length ? <div className={styles.emptyState}><span>01</span><div><strong>Buat gudang terlebih dahulu</strong><p>Produk harus terdaftar pada lokasi gudang agar stok dan ongkir bisa dikelola.</p></div><button type="button" className={styles.button} onClick={() => setAdminSection('warehouses')}>＋ Buat gudang</button></div> : <form className={styles.productForm} onSubmit={createProduct}>
        <label className={styles.full}>Nama produk<input name="name" required maxLength="200" placeholder="Contoh: Cabai kering pilihan" /></label>
        <label>Kategori<input name="category" defaultValue="Rempah" required /></label><label>Harga (IDR)<input name="price" type="number" min="0" step="1" required placeholder="25000" /></label>
        <label>Stok awal<input name="stock" type="number" min="0" step="1" required defaultValue="0" /></label><label>Satuan<input name="satuan" defaultValue="unit" maxLength="40" required placeholder="kg, pcs, botol…" /></label>
        <label className={`${styles.full} ${styles.uploadField}`}>Foto utama produk<input name="localImage" type="file" accept="image/*" required /><small>Pilih foto dari perangkat. Tidak perlu memasukkan URL.</small></label>
        <details className={`${styles.formDisclosure} ${styles.full}`}><summary>Detail tambahan <span>URL, ongkir, deskripsi produk</span></summary><div className={styles.formSubgrid}>
          <label>Slug URL (opsional)<input name="slug" placeholder="Otomatis dari nama produk" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
          <label>Berat per unit (gram)<input name="shippingWeightGram" type="number" min="1" step="1" placeholder="250" /></label><label>Asal pengiriman<input name="origin" maxLength="300" placeholder="Contoh: Bandung" /></label>
          <label>Panjang paket (cm)<input name="shippingLengthCm" type="number" min="1" step="1" /></label><label>Lebar paket (cm)<input name="shippingWidthCm" type="number" min="1" step="1" /></label><label>Tinggi paket (cm)<input name="shippingHeightCm" type="number" min="1" step="1" /></label><label>Lama panen / produksi<input name="harvestDuration" maxLength="120" placeholder="Contoh: 4 bulan" /></label>
          <label className={styles.full}>Deskripsi singkat<textarea name="description" maxLength="10000" rows="3" /></label><label className={styles.full}>Deskripsi lengkap<textarea name="longDescription" maxLength="20000" rows="4" /></label>
          <label className={styles.full}>Keunggulan (satu per baris)<textarea name="highlights" rows="3" placeholder={'Dipanen saat matang\\nDikemas dengan baik'} /></label>
          <label className={`${styles.full} ${styles.uploadField}`}>Foto galeri (opsional)<input name="localGallery" type="file" accept="image/*" multiple /><small>Pilih beberapa foto sekaligus untuk menambah galeri.</small></label>
        </div></details>
        <div className={`${styles.formActions} ${styles.full}`}><button className={styles.button} disabled={busy || !selectedWarehouseId}>{busy ? 'Mengunggah & menyimpan…' : '＋ Simpan produk'}</button></div>
      </form>}</section>}

      {adminOnly && adminSection === 'products' && user?.role === 'admin' && <section className={styles.panel}><div className={styles.panelToolbar}><h2>Produk di {selectedWarehouse?.name || 'gudang terpilih'} <span className={styles.countBadge}>{warehouseProducts.length}</span></h2></div>{!selectedWarehouse ? <p className={styles.emptyHint}>Pilih gudang aktif untuk melihat daftar produknya.</p> : warehouseProducts.length === 0 ? <p>Belum ada produk yang dikelompokkan di gudang ini.</p> : <div className={styles.productList}>{warehouseProducts.map((product) => <details className={styles.productEditor} key={product.id}>
        <summary>{product.image_url && <img className={styles.productThumb} src={product.image_url} alt="" />}<span><strong>{product.name}</strong><small>{format(product.price)} · Stok {product.stock} {product.satuan || 'unit'}</small></span><b>✎ Kelola</b></summary>
        <form className={styles.productForm} onSubmit={(event) => updateProduct(event, product)}>
        <label className={styles.full}>Nama produk<input name="name" defaultValue={product.name} required /></label>
        <label>Kategori<input name="category" defaultValue={product.category} required /></label><label>Harga (IDR)<input name="price" type="number" min="0" step="1" defaultValue={product.price} required /></label>
        <label>Total stok semua gudang<input name="stock" type="number" min="0" defaultValue={product.stock} readOnly /><small>Ubah jumlah dari menu Gudang.</small></label><label>Satuan<input name="satuan" defaultValue={product.satuan || 'unit'} required maxLength={40} /></label>
        <label className={`${styles.full} ${styles.uploadField}`}>Ganti foto utama<input name="localImage" type="file" accept="image/*" /><small>Foto saat ini: {product.image_url ? 'tersimpan. Pilih file baru jika ingin mengganti.' : 'belum tersedia.'}</small></label>
        <details className={`${styles.formDisclosure} ${styles.full}`}><summary>Detail tambahan <span>Alamat halaman, ongkir, deskripsi, galeri</span></summary><div className={styles.formSubgrid}>
          <label>Slug halaman<input name="slug" defaultValue={product.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label>Asal produk<input name="origin" defaultValue={product.origin} /></label>
          <label>Berat per unit (gram)<input name="shippingWeightGram" type="number" min="1" step="1" defaultValue={product.shipping_weight_gram || ''} /></label><label>Panjang paket (cm)<input name="shippingLengthCm" type="number" min="1" step="1" defaultValue={product.shipping_length_cm || ''} /></label><label>Lebar paket (cm)<input name="shippingWidthCm" type="number" min="1" step="1" defaultValue={product.shipping_width_cm || ''} /></label><label>Tinggi paket (cm)<input name="shippingHeightCm" type="number" min="1" step="1" defaultValue={product.shipping_height_cm || ''} /></label>
          <label>Lama panen / produksi<input name="harvestDuration" maxLength="120" defaultValue={product.harvest_duration || ''} placeholder="Contoh: 4 bulan" /></label>
          <label className={styles.full}>Deskripsi singkat<textarea name="description" rows="3" defaultValue={product.description} /></label><label className={styles.full}>Deskripsi lengkap<textarea name="longDescription" maxLength="20000" rows="4" defaultValue={product.long_description || ''} /></label>
          <label className={styles.full}>Keunggulan (satu per baris)<textarea name="highlights" rows="3" defaultValue={formatProductList(product.highlights_json)} /></label>
          <label className={`${styles.full} ${styles.uploadField}`}>Tambah foto galeri<input name="localGallery" type="file" accept="image/*" multiple /><small>Foto baru akan ditambahkan ke galeri produk.</small></label>
        </div></details>
        <div className={`${styles.formActions} ${styles.full}`}><button className={styles.button} disabled={busy}>{busy ? 'Mengunggah & menyimpan…' : 'Simpan perubahan'}</button><button className={styles.dangerButton} type="button" disabled={busy} onClick={() => { if (window.confirm(`Nonaktifkan produk “${product.name}”?`)) send(`/api/products/${encodeURIComponent(product.slug)}`, {}, 'DELETE'); }}>Nonaktifkan produk</button></div>
      </form></details>)}</div>}</section>}

      {adminOnly && adminSection === 'customers' && user?.role === 'admin' && <section className={styles.panel}><h2>Pelanggan & wallet</h2><p className={styles.panelHint}>Cari pelanggan berdasarkan nama, username, atau email. Pilih pelanggan untuk mencatat mutasi saldo.</p><label className={styles.customerSearch}>Cari pelanggan<input value={customerQuery} onChange={(event)=>setCustomerQuery(event.target.value)} placeholder="Nama, username, atau email" /></label><div className={styles.customerList}>{customers.filter((customer)=>`${customer.full_name} ${customer.username} ${customer.email}`.toLowerCase().includes(customerQuery.toLowerCase())).map((customer)=><button type="button" className={walletCustomerId===customer.id?styles.customerSelected:styles.customerOption} key={customer.id} onClick={()=>setWalletCustomerId(customer.id)}><span><strong>{customer.full_name}</strong><small>@{customer.username} · {customer.email}</small></span><b>{format(customer.wallet_balance)}</b></button>)}</div>{walletCustomerId&&<form className={styles.inlineForm} onSubmit={adjustWallet}><select name="direction" defaultValue="credit"><option value="credit">Tambah saldo</option><option value="debit">Kurangi saldo</option></select><input name="amount" type="number" min="1" step="1" placeholder="Nominal IDR" required /><input name="description" placeholder="Alasan / referensi" minLength="3" maxLength="300" required /><button className={styles.button} disabled={busy}>Simpan mutasi</button></form>}</section>}

      {((adminOnly && adminSection === 'orders') || (!adminOnly && section === 'orders')) && <section className={styles.panel}><div className={styles.panelToolbar}><h2>{adminOnly ? 'Kelola pesanan' : 'Riwayat pesanan'}</h2>{adminOnly && <button className={styles.secondary} disabled={busy} onClick={reconcileShipments}>Rekonsiliasi tracking</button>}</div>{orders.length === 0 ? <p>Belum ada pesanan.</p> : <div className={styles.list}>{orders.map((order) => <article className={styles.order} key={order.id}>
        <div className={styles.orderHead}><strong>Pesanan #{order.id.slice(0, 8)}</strong><span>{order.status.replaceAll('_', ' ')}</span></div>
        {adminOnly && <p>Pelanggan: {order.customer_name}</p>}<p>Total: {format(order.total)} (perkiraan; tagihan pembayaran dalam IDR) · Pembayaran: {order.payment_status || 'pending'}</p><p>Alamat: {order.shipping_address}</p>
        <ul>{order.items.map((item) => <li key={item.id}>{item.name} × {item.quantity} {item.satuan || 'unit'} — {format(item.line_total)}</li>)}</ul>
        {order.shipment?.tracking_number && <p className={styles.shipment}><img src="/Pictures/asset/shipment%20icon.png" alt="" />Pengiriman: {order.shipment.carrier} · Status {order.shipment.jubelio_status || order.shipment.state || order.status} · Resi {order.shipment.tracking_number} {order.shipment.tracking_url && <a href={order.shipment.tracking_url} target="_blank" rel="noreferrer">Lacak</a>}</p>}
        {adminOnly && order.payment_status === 'paid' && !['CREATED','CREATING','UNKNOWN'].includes(order.shipment?.state) && <button className={styles.button} disabled={busy} onClick={() => createShipment(order.id)}>Buat resi Jubelio</button>}
        {adminOnly && order.shipment?.state && !order.shipment?.tracking_number && <p>Status resi Jubelio: {order.shipment.state}. Jangan ulangi request selama state aktif.</p>}
        {adminOnly && order.shipment?.state === 'CREATED' && <button className={styles.secondary} disabled={busy} onClick={() => cancelShipment(order.id)}>Batalkan resi</button>}
        {adminOnly && ['UNKNOWN','CREATING'].includes(order.shipment?.state) && <form className={styles.inlineForm} onSubmit={(event) => {event.preventDefault(); resolveShipment(order.id);}}><input aria-label="AWB hasil pemeriksaan Jubelio" placeholder="AWB dari dashboard Jubelio; kosongkan bila tidak terbit" value={resolutionAwbs[order.id] || ''} onChange={(event) => setResolutionAwbs({...resolutionAwbs,[order.id]:event.target.value})} /><button className={styles.button}>Selesaikan percobaan resi</button></form>}
        {!adminOnly && order.status === 'pending_payment' && <div className={styles.inlineForm}>
          {order.payment_url
            ? <a className={styles.button} href={order.payment_url} target="_blank" rel="noreferrer">Lanjutkan pembayaran</a>
            : <button className={styles.button} disabled={busy} onClick={() => startPayment(order.id)}>Buat pembayaran Tripay</button>}
          {order.payment_method && <span>Metode: {order.payment_method}</span>}
          {order.payment_code && <strong>Kode pembayaran: {order.payment_code}</strong>}
          {order.expires_at && <span>Batas pembayaran: {new Date(order.expires_at).toLocaleString('id-ID')}</span>}
        </div>}
        {!adminOnly && order.status === 'payment_review' && <p>Pembayaran sedang ditinjau.</p>}
        {adminOnly && order.status === 'paid' && <button className={styles.button} disabled={busy} onClick={() => send(`/api/orders/${order.id}`, { status: 'processing' }, 'PATCH')}>Mulai proses pesanan</button>}
        {adminOnly && ['pending_payment','payment_review'].includes(order.status) && <button className={styles.secondary} disabled={busy} onClick={() => send(`/api/orders/${order.id}`, { status: 'cancelled' }, 'PATCH')}>Batalkan pesanan belum dibayar</button>}
        {!adminOnly && order.status === 'delivered' && order.items.map((item) => <form className={styles.reviewForm} key={`review-${item.id}`} onSubmit={(event) => submitReview(event, item.id)}><span>Ulas {item.name}</span><select name="rating" defaultValue="6" aria-label="Rating"><option value="6">6 ★</option><option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option></select><input name="body" placeholder="Tulis ulasan" maxLength="3000" /><button className={styles.secondary}>Kirim ulasan</button></form>)}
        {!adminOnly && <button className={styles.secondary} onClick={() => { setSelectedConversation(''); setSelectedOrderId(order.id); setNotice(`Pesan baru terkait pesanan ${order.id.slice(0,8)}.`); }}>Hubungi suplier</button>}
      </article>)}</div>}</section>}

      {((adminOnly && adminSection === 'messages') || (!adminOnly && section === 'messages')) && <section className={styles.panel}><h2>{adminOnly ? 'Inbox pesan' : 'Percakapan'}</h2>{conversations.map((conversation) => <article className={styles.conversation} key={conversation.id}><button className={styles.conversationTitle} onClick={() => setSelectedConversation(conversation.id)}>{adminOnly ? conversation.customer_name : conversation.subject}{conversation.order_id ? ` · pesanan ${conversation.order_id.slice(0,8)}` : ''}</button>{conversation.messages.map((item) => <p key={item.id}><strong>{item.sender_id === user?.id ? 'Anda' : adminOnly ? 'Suplier' : 'Suplier'}:</strong> {item.body}</p>)}</article>)}
        <form className={styles.messageForm} onSubmit={submitMessage}><p>{selectedConversation ? 'Membalas percakapan terpilih.' : selectedOrderId ? `Percakapan untuk pesanan ${selectedOrderId.slice(0,8)}.` : adminOnly ? 'Pilih percakapan untuk membalas.' : 'Mulai percakapan bantuan baru.'}</p><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength="5000" required placeholder="Tulis pesan…" /><button className={styles.button} disabled={busy || (adminOnly && !selectedConversation)}>Kirim pesan</button></form>
      </section>}
    </main>
  );
}
