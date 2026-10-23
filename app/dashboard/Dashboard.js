'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrency } from '@/app/components/CurrencyProvider';
import styles from './dashboard.module.css';

const ORDER_STEPS = ['payment_review', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export default function Dashboard({ adminOnly = false }) {
  const { format } = useCurrency();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [meResponse, ordersResponse, messagesResponse, productsResponse] = await Promise.all([
      fetch('/api/auth/me'), fetch('/api/orders'), fetch('/api/messages'), fetch('/api/products'),
    ]);
    const me = await meResponse.json();
    if (!meResponse.ok || !me.user) throw new Error(me.error || 'Silakan login terlebih dahulu.');
    if (adminOnly && me.user.role !== 'admin') throw new Error('Halaman ini khusus administrator.');
    const orderData = await ordersResponse.json();
    const messageData = await messagesResponse.json();
    const productData = await productsResponse.json();
    setUser(me.user);
    if (!ordersResponse.ok) throw new Error(orderData.error || 'Pesanan gagal dimuat.');
    if (!messagesResponse.ok) throw new Error(messageData.error || 'Pesan gagal dimuat.');
    setOrders(orderData.orders || []);
    setConversations(messageData.conversations || []);
    setProducts(adminOnly ? (productData.products || []) : []);
  }

  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);

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

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
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
    const result = await send('/api/products', {
      name: form.get('name'), slug: form.get('slug'), category: form.get('category'),
      description: form.get('description'), price: form.get('price'), stock: form.get('stock'), satuan: form.get('satuan'),
      origin: form.get('origin'), imageUrl: form.get('imageUrl'),
    });
    if (result) formElement.reset();
  }

  async function updateOrder(event, orderId) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await send(`/api/orders/${orderId}`, {
      status: form.get('status'), carrier: form.get('carrier'),
      trackingNumber: form.get('trackingNumber'), trackingUrl: form.get('trackingUrl'),
    }, 'PATCH');
  }

  async function updateProduct(event, slug) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await send(`/api/products/${encodeURIComponent(slug)}`, {
      name: form.get('name'), slug: form.get('slug'), category: form.get('category'),
      description: form.get('description'), price: form.get('price'), stock: form.get('stock'), satuan: form.get('satuan'),
      origin: form.get('origin'), imageUrl: form.get('imageUrl'),
    }, 'PATCH');
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

  if (error && !user) return <main className={styles.page}><Link href="/">← Katalog</Link><section className={styles.panel}><h1>{adminOnly ? 'Portal administrator' : 'Akun marketplace'}</h1><p>{error}</p><Link className={styles.button} href="/login">Login</Link></section></main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}><div><Link href="/" className={styles.brand}>REMPAH NUSANTARA</Link><h1>{adminOnly ? 'Portal Admin' : 'Akun Saya'}</h1><p>{user?.full_name} · @{user?.username} · {user?.email} · {user?.phone || 'Nomor HP belum ditambahkan'} · {user?.role}</p></div><div className={styles.headerActions}><Link className={styles.button} href="/cart"><img className={styles.actionIcon} src="/Pictures/asset/cart%20icon.png" alt="" />Keranjang</Link><button className={styles.secondary} onClick={logout}>Keluar</button></div></header>
      {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}

      {adminOnly && user?.role === 'admin' && <section className={styles.panel}><h2>Daftarkan produk</h2><form className={styles.productForm} onSubmit={createProduct}>
        <label>Nama<input name="name" required maxLength="200" /></label><label>Slug URL<input name="slug" placeholder="contoh: lada-hitam" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
        <label>Kategori<input name="category" defaultValue="Rempah" required /></label><label>Harga (IDR)<input name="price" type="number" min="0" step="1" required /></label>
        <label>Stok<input name="stock" type="number" min="0" step="1" required /></label><label>Satuan (kg, pcs, unit, dll)<input name="satuan" defaultValue="unit" maxLength="40" required /></label><label>Asal pengiriman<input name="origin" maxLength="300" /></label>
        <label className={styles.full}>URL gambar<input name="imageUrl" type="url" /></label><label className={styles.full}>Deskripsi<textarea name="description" maxLength="10000" rows="4" /></label>
        <button className={styles.button} disabled={busy}>Simpan produk</button>
      </form></section>}

      {adminOnly && user?.role === 'admin' && <section className={styles.panel}><h2>Produk aktif ({products.length})</h2>{products.length === 0 ? <p>Belum ada produk dari database.</p> : <div className={styles.list}>{products.map((product) => <form className={styles.productForm} key={product.id} onSubmit={(event) => updateProduct(event, product.slug)}>
        <label>Nama<input name="name" defaultValue={product.name} required /></label><label>Slug<input name="slug" defaultValue={product.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
        <label>Kategori<input name="category" defaultValue={product.category} required /></label><label>Harga<input name="price" type="number" min="0" step="1" defaultValue={product.price} required /></label>
        <label>Stok<input name="stock" type="number" min="0" defaultValue={product.stock} required /></label><label>Satuan<input name="satuan" defaultValue={product.satuan || 'unit'} required maxLength={40} /></label><label>Asal<input name="origin" defaultValue={product.origin} /></label>
        <label className={styles.full}>URL gambar<input name="imageUrl" type="url" defaultValue={product.image_url} /></label><label className={styles.full}>Deskripsi<textarea name="description" rows="3" defaultValue={product.description} /></label>
        <button className={styles.button} disabled={busy}>Simpan perubahan</button><button className={styles.secondary} type="button" onClick={() => send(`/api/products/${encodeURIComponent(product.slug)}`, {}, 'DELETE')}>Nonaktifkan</button>
      </form>)}</div>}</section>}

      <section className={styles.panel}><h2>{adminOnly ? 'Kelola pesanan' : 'Pesanan saya'}</h2>{orders.length === 0 ? <p>Belum ada pesanan.</p> : <div className={styles.list}>{orders.map((order) => <article className={styles.order} key={order.id}>
        <div className={styles.orderHead}><strong>Pesanan #{order.id.slice(0, 8)}</strong><span>{order.status.replaceAll('_', ' ')}</span></div>
        {adminOnly && <p>Pelanggan: {order.customer_name}</p>}<p>Total: {format(order.total)} (perkiraan; tagihan pembayaran dalam IDR) · Pembayaran: {order.payment_status || 'pending'}</p><p>Alamat: {order.shipping_address}</p>
        <ul>{order.items.map((item) => <li key={item.id}>{item.name} × {item.quantity} {item.satuan || 'unit'} — {format(item.line_total)}</li>)}</ul>
        {order.shipment?.tracking_number && <p className={styles.shipment}><img src="/Pictures/asset/shipment%20icon.png" alt="" />Pengiriman: {order.shipment.carrier} · Resi {order.shipment.tracking_number} {order.shipment.tracking_url && <a href={order.shipment.tracking_url} target="_blank" rel="noreferrer">Lacak</a>}</p>}
        {!adminOnly && order.status === 'pending_payment' && <div className={styles.inlineForm}>
          {order.payment_url
            ? <a className={styles.button} href={order.payment_url} target="_blank" rel="noreferrer">Lanjutkan pembayaran</a>
            : <button className={styles.button} disabled={busy} onClick={() => startPayment(order.id)}>Buat pembayaran Tripay</button>}
          {order.payment_method && <span>Metode: {order.payment_method}</span>}
          {order.payment_code && <strong>Kode pembayaran: {order.payment_code}</strong>}
          {order.expires_at && <span>Batas pembayaran: {new Date(order.expires_at).toLocaleString('id-ID')}</span>}
        </div>}
        {!adminOnly && order.status === 'payment_review' && <p>Pembayaran sedang ditinjau.</p>}
        {adminOnly && <form className={styles.adminOrderForm} onSubmit={(event) => updateOrder(event, order.id)}><select name="status" defaultValue={order.status === 'pending_payment' ? 'payment_review' : order.status}>{ORDER_STEPS.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select><input name="carrier" placeholder="Kurir" /><input name="trackingNumber" placeholder="Nomor resi" /><input name="trackingUrl" placeholder="URL tracking" /><button className={styles.button}>Perbarui</button></form>}
        {!adminOnly && order.status === 'delivered' && order.items.map((item) => <form className={styles.reviewForm} key={`review-${item.id}`} onSubmit={(event) => submitReview(event, item.id)}><span>Ulas {item.name}</span><select name="rating" defaultValue="5" aria-label="Rating"><option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option></select><input name="body" placeholder="Tulis ulasan" maxLength="3000" /><button className={styles.secondary}>Kirim ulasan</button></form>)}
        {!adminOnly && <button className={styles.secondary} onClick={() => { setSelectedConversation(''); setSelectedOrderId(order.id); setNotice(`Pesan baru terkait pesanan ${order.id.slice(0,8)}.`); }}>Hubungi admin</button>}
      </article>)}</div>}</section>

      <section className={styles.panel}><h2>{adminOnly ? 'Inbox pesan' : 'Pesan dengan admin'}</h2>{conversations.map((conversation) => <article className={styles.conversation} key={conversation.id}><button className={styles.conversationTitle} onClick={() => setSelectedConversation(conversation.id)}>{adminOnly ? conversation.customer_name : conversation.subject}{conversation.order_id ? ` · pesanan ${conversation.order_id.slice(0,8)}` : ''}</button>{conversation.messages.map((item) => <p key={item.id}><strong>{item.sender_id === user?.id ? 'Anda' : adminOnly ? 'Pelanggan' : 'Admin'}:</strong> {item.body}</p>)}</article>)}
        <form className={styles.messageForm} onSubmit={submitMessage}><p>{selectedConversation ? 'Membalas percakapan terpilih.' : selectedOrderId ? `Percakapan untuk pesanan ${selectedOrderId.slice(0,8)}.` : adminOnly ? 'Pilih percakapan untuk membalas.' : 'Mulai percakapan bantuan baru.'}</p><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength="5000" required placeholder="Tulis pesan…" /><button className={styles.button} disabled={busy || (adminOnly && !selectedConversation)}>Kirim pesan</button></form>
      </section>
    </main>
  );
}
