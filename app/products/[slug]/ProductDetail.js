'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCurrency } from '@/app/components/CurrencyProvider';
import styles from './product.module.css';

export default function ProductDetail() {
  const { slug } = useParams();
  const router = useRouter();
  const { format } = useCurrency();
  const [product, setProduct] = useState(null);
  const [catalogFallback, setCatalogFallback] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/products/${encodeURIComponent(slug)}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Produk tidak tersedia.');
      if (active) setProduct(data.product);
    }).catch((cause) => {
      if (!active) return;
      const params = new URLSearchParams(window.location.search);
      const name = params.get('name');
      const image = params.get('image');
      if (name && image) setCatalogFallback({ name, image_url: image, stock: 0, satuan: 'unit', price: 0, origin: '', description: '' });
      else setError(cause.message);
    });
    return () => { active = false; };
  }, [slug]);

  function addToCart() {
    const cart = JSON.parse(localStorage.getItem('comotrade_cart') || '[]');
    const existing = cart.find((item) => item.productId === product.id);
    if (existing) existing.quantity += quantity;
    else cart.push({ productId: product.id, slug: product.slug, name: product.name, price: Number(product.price), imageUrl: product.image_url, satuan: product.satuan || 'unit', quantity });
    localStorage.setItem('comotrade_cart', JSON.stringify(cart));
    setNotice('Produk ditambahkan ke keranjang.');
  }

  async function buyNow(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ productId: product.id, quantity }], shippingAddress: address }),
      });
      const data = await response.json();
      if (response.status === 401) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Pesanan belum dapat dibuat.');
      router.push(`/account?order=${data.order.id}`);
    } catch (cause) { setNotice(cause.message); }
    finally { setBusy(false); }
  }

  if (error) return <main className={styles.page}><Link href="/">← Kembali ke katalog</Link><p className={styles.feedback}>{error}</p><p>Produk perlu didaftarkan oleh admin dan tersedia di database marketplace.</p></main>;
  if (!product && !catalogFallback) return <main className={styles.page}><p>Memuat detail produk…</p></main>;
  const displayedProduct = product || catalogFallback;
  const unit = displayedProduct.satuan || 'unit';
  const packaging = quantity <= 10
    ? { image: 'small pouch packaging.png', label: 'Kemasan pouch kecil' }
    : quantity <= 50
      ? { image: 'medium box packaging.png', label: 'Kemasan kotak sedang' }
      : { image: 'large gunny sack packaging.png', label: 'Kemasan karung besar' };
  const estimatedSubtotal = product ? Number(product.price) * quantity : 0;

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>← Kembali ke katalog</Link>
      <section className={styles.product}>
        <div className={styles.image}>{displayedProduct.image_url && <img src={displayedProduct.image_url} alt={displayedProduct.name} />}</div>
        <div className={styles.details}>
          <span className={styles.eyebrow}>REMPAH NUSANTARA</span>
          <h1>{displayedProduct.name}</h1>
          <p className={styles.price}>{product ? `${format(product.price)} / ${unit}` : 'Harga belum tersedia'}</p>
          <p className={styles.description}>{displayedProduct.description || 'Deskripsi produk belum ditambahkan.'}</p>
          <dl><div><dt>Stok</dt><dd>{displayedProduct.stock} {unit}</dd></div><div><dt>Satuan</dt><dd>{unit}</dd></div><div><dt>Asal pengiriman</dt><dd>{displayedProduct.origin || 'Belum ditentukan'}</dd></div></dl>
          {!product && <p className={styles.feedback}>Produk katalog contoh. Administrator perlu mendaftarkan produk ini di database agar bisa dibeli.</p>}
          {product && product.stock > 0 ? <>
            <label className={styles.quantity}>Jumlah ({unit})<input type="number" min="1" max={product.stock} value={quantity} onChange={(event) => setQuantity(Math.min(product.stock, Math.max(1, Number(event.target.value) || 1)))} /></label>
            <section className={styles.packageSummary} aria-live="polite" aria-label="Ringkasan jumlah pesanan">
              <img src={`/Pictures/asset/${encodeURIComponent(packaging.image)}`} alt={packaging.label} />
              <div><strong>{packaging.label}</strong><span>{quantity} {unit} × {format(product.price)}</span></div>
              <p>Perkiraan subtotal <strong>{format(estimatedSubtotal)}</strong></p>
            </section>
            <label className={styles.address}>Alamat pengiriman<textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Isi alamat lengkap sebelum membeli" /></label>
            {notice && <p className={styles.feedback} role="status">{notice}</p>}
            <div className={styles.actions}><button type="button" onClick={addToCart}>Tambah ke keranjang</button><button type="button" onClick={buyNow} disabled={busy || address.trim().length < 8}>{busy ? 'Memproses…' : 'Beli sekarang'}</button></div>
          </> : product ? <p className={styles.feedback}>Stok sedang habis.</p> : null}
        </div>
      </section>
    </main>
  );
}
