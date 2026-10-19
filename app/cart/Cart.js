'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './cart.module.css';

export default function Cart() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem('comotrade_cart') || '[]')); }
    catch { localStorage.removeItem('comotrade_cart'); }
  }, []);

  function save(next) { setItems(next); localStorage.setItem('comotrade_cart', JSON.stringify(next)); }
  const total = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  async function checkout(event) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ items:items.map(({productId,quantity})=>({productId,quantity})), shippingAddress:address }) });
      const data = await response.json();
      if (response.status === 401) { router.push('/login'); return; }
      if (!response.ok) throw new Error(data.error || 'Checkout gagal.');
      localStorage.removeItem('comotrade_cart');
      router.push(`/account?order=${data.order.id}`);
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}><Link href="/">← Kembali ke katalog</Link><h1>Keranjang belanja</h1>{items.length ? <div className={styles.layout}><section className={styles.items}>{items.map((item)=><article className={styles.item} key={item.productId}>{item.imageUrl && <img src={item.imageUrl} alt="" />}<div><Link href={`/products/${item.slug || item.productId}`}>{item.name}</Link><p>Rp {Number(item.price).toLocaleString('id-ID')}</p><label>Jumlah <input type="number" min="1" max="99" value={item.quantity} onChange={(event)=>{const next=items.map((entry)=>entry.productId===item.productId?{...entry,quantity:Math.max(1,Number(event.target.value)||1)}:entry);save(next);}} /></label></div><button onClick={()=>save(items.filter((entry)=>entry.productId!==item.productId))}>Hapus</button></article>)}</section><form className={styles.checkout} onSubmit={checkout}><h2>Ringkasan</h2><p>Total barang <strong>Rp {total.toLocaleString('id-ID')}</strong></p><label>Alamat pengiriman<textarea required minLength="8" value={address} onChange={(event)=>setAddress(event.target.value)} /></label>{notice&&<p role="alert">{notice}</p>}<button disabled={busy}>{busy?'Memproses…':'Buat pesanan'}</button><small>Stok divalidasi kembali di server saat pesanan dibuat.</small></form></div>:<p>Keranjang masih kosong. <Link href="/">Pilih produk</Link></p>}</main>;
}
