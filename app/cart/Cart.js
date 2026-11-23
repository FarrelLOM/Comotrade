'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrency } from '@/app/components/CurrencyProvider';
import styles from './cart.module.css';
import checkoutStyles from '@/app/checkout/checkout.module.css';

export default function Cart() {
  const { format } = useCurrency();
  const [items, setItems] = useState([]);

  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem('comotrade_cart') || '[]')); }
    catch { localStorage.removeItem('comotrade_cart'); }
  }, []);

  function save(next) { setItems(next); localStorage.setItem('comotrade_cart', JSON.stringify(next)); }
  const total = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  return <main className={`${styles.page} commerce-surface`}><Link href="/">← Kembali ke katalog</Link><h1>Keranjang belanja</h1>{items.length ? <div className={styles.layout}><section className={styles.items}>{items.map((item)=><article className={styles.item} key={item.productId}>{item.imageUrl && <img src={item.imageUrl} alt="" />}<div><Link href={`/products/${item.slug || item.productId}`}>{item.name}</Link><p>{format(item.price)} / {item.satuan || 'unit'}</p><label>Jumlah ({item.satuan || 'unit'}) <input type="number" min="1" max="1000000" value={item.quantity} onChange={(event)=>{const next=items.map((entry)=>entry.productId===item.productId?{...entry,quantity:Math.max(1,Number(event.target.value)||1)}:entry);save(next);}} /></label></div><button onClick={()=>save(items.filter((entry)=>entry.productId!==item.productId))}>Hapus</button></article>)}</section><aside className={styles.checkout}><h2>Ringkasan</h2><p>Total barang <strong>{format(total)}</strong></p><small>Ongkir dihitung setelah Anda memilih alamat dan layanan kurir.</small><Link className={checkoutStyles.action} href="/checkout">Lanjut ke konfirmasi</Link></aside></div>:<p>Keranjang masih kosong. <Link href="/">Pilih produk</Link></p>}</main>;
}
