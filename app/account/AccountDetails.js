'use client';

import { useEffect, useState } from 'react';
import styles from './account-details.module.css';

const emptyAddress = { id: '', label: 'Rumah', recipientName: '', recipientPhone: '', addressLine: '', areaName: '', districtName: '', cityName: '', provinceName: '', areaId: '', zipcode: '', coordinate: '', isDefault: false };
const idr = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(amount) || 0);
const toFormAddress = (address) => ({
  id: address.id, label: address.label, recipientName: address.recipient_name, recipientPhone: address.recipient_phone,
  addressLine: address.address_line, areaName: address.area_name, districtName: address.district_name,
  cityName: address.city_name, provinceName: address.province_name, areaId: address.area_id,
  zipcode: address.zipcode, coordinate: address.coordinate || '', isDefault: Boolean(address.is_default),
});

export default function AccountDetails({ view = 'profile' }) {
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [address, setAddress] = useState(emptyAddress);
  const [editingId, setEditingId] = useState('');
  const [regionQuery, setRegionQuery] = useState('');
  const [regions, setRegions] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const needsProfile = view === 'profile' || view === 'wallet';
    const [profileResponse, addressResponse] = await Promise.all([
      needsProfile ? fetch('/api/profile', { cache: 'no-store' }) : Promise.resolve(null),
      view === 'addresses' ? fetch('/api/addresses', { cache: 'no-store' }) : Promise.resolve(null),
    ]);
    if (profileResponse) {
      const profileData = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(profileData.error || 'Profil belum tersedia.');
      setProfile(profileData.user);
      setWallet(profileData.wallet || { balance: 0, transactions: [] });
    }
    if (addressResponse) {
      const addressData = await addressResponse.json();
      if (!addressResponse.ok) throw new Error(addressData.error || 'Alamat belum tersedia.');
      setAddresses(addressData.addresses || []);
    }
  }

  useEffect(() => { load().catch((cause) => setError(cause.message)); }, [view]);

  async function saveProfile(event) {
    event.preventDefault(); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: form.get('fullName'), phone: form.get('phone') }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Profil belum dapat disimpan.');
      setProfile({ ...profile, ...data.user }); setMessage('Profil berhasil diperbarui.');
    } catch (cause) { setError(cause.message); }
  }

  async function findRegions(value) {
    setRegionQuery(value); setError('');
    if (value.trim().length < 3) { setRegions([]); return; }
    try {
      const response = await fetch(`/api/shipping/regions?q=${encodeURIComponent(value.trim())}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Wilayah belum dapat dicari.');
      setRegions((data.regions || []).slice(0, 12));
    } catch (cause) { setError(cause.message); }
  }

  function chooseRegion(region) {
    setAddress((current) => ({ ...current, areaId: String(region.area_id), zipcode: String(region.zipcode), areaName: region.area || region.area_name || '', districtName: region.district || '', cityName: region.city || '', provinceName: region.province || '' }));
    setRegionQuery([region.area, region.district, region.city, region.province].filter(Boolean).join(', '));
    setRegions([]);
  }

  async function saveAddress(event) {
    event.preventDefault(); setError(''); setMessage('');
    try {
      const response = await fetch(editingId ? `/api/addresses/${editingId}` : '/api/addresses', {
        method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(address),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Alamat belum dapat disimpan.');
      await load(); setAddress(emptyAddress); setEditingId(''); setRegionQuery(''); setMessage('Alamat berhasil disimpan.');
    } catch (cause) { setError(cause.message); }
  }

  async function deleteAddress(id) {
    if (!window.confirm('Hapus alamat ini?')) return;
    try {
      const response = await fetch(`/api/addresses/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Alamat belum dapat dihapus.');
      await load();
    } catch (cause) { setError(cause.message); }
  }

  return <div className={`${styles.grid} ${styles[view] || ''}`}>
    {(view === 'profile' || view === 'all') && <section className={styles.panel} id="informasi-akun"><h2>Informasi akun</h2>{profile && <form className={styles.profileForm} onSubmit={saveProfile}>
      <label>Nama lengkap<input name="fullName" defaultValue={profile.full_name} required minLength="2" maxLength="120" /></label>
      <label>Username<input value={profile.username || ''} readOnly /></label>
      <label>Email<input value={profile.email || ''} readOnly /></label>
      <label>Nomor HP<input name="phone" type="tel" defaultValue={profile.phone || ''} maxLength="30" /></label>
      <button className={styles.button}>Simpan profil</button>
    </form>}</section>}

    {(view === 'wallet' || view === 'all') && <section className={styles.panel} id="saldo"><div className={styles.walletHeading}><h2>Saldo tersedia</h2><strong>{idr(wallet.balance)}</strong></div><p className={styles.hint}>Wallet pelanggan Comotrade. Saldo ini berbeda dari Jubelio Wallet milik toko.</p><div className={styles.ledger}>{wallet.transactions.length ? wallet.transactions.map((transaction) => <div className={styles.ledgerRow} key={transaction.id}><span><b>{transaction.description || transaction.transaction_type}</b><small>{new Date(transaction.created_at).toLocaleString('id-ID')}</small></span><strong className={Number(transaction.amount) >= 0 ? styles.credit : styles.debit}>{Number(transaction.amount) >= 0 ? '+' : ''}{idr(transaction.amount)}</strong></div>) : <p>Belum ada transaksi wallet.</p>}</div></section>}

    {(view === 'addresses' || view === 'all') && <section className={styles.panel} id="alamat"><div className={styles.sectionHeading}><h2>Alamat tersimpan</h2><button type="button" className={styles.secondary} onClick={() => {setAddress(emptyAddress);setEditingId('');setRegionQuery('');}}>Tambah alamat</button></div>
      {addresses.map((saved) => <article className={styles.addressCard} key={saved.id}><div><strong>{saved.label}{saved.is_default ? ' · Utama' : ''}</strong><p>{saved.recipient_name} · {saved.recipient_phone}<br />{saved.address_line}<br />{[saved.area_name,saved.district_name,saved.city_name,saved.province_name,saved.zipcode].filter(Boolean).join(', ')}</p></div><div className={styles.addressActions}><button type="button" onClick={() => {setAddress(toFormAddress(saved));setEditingId(saved.id);setRegionQuery([saved.area_name,saved.district_name,saved.city_name,saved.province_name].filter(Boolean).join(', '));}}>Ubah</button><button type="button" onClick={() => deleteAddress(saved.id)}>Hapus</button></div></article>)}
      <p className={styles.hint}>Gunakan pencarian wilayah agar area ID dan kode pos sesuai data Jubelio.</p>
      <form className={styles.addressForm} onSubmit={saveAddress}>
        <label>Label<input value={address.label} onChange={(event)=>setAddress({...address,label:event.target.value})} required maxLength="60" /></label>
        <label>Nama penerima<input value={address.recipientName} onChange={(event)=>setAddress({...address,recipientName:event.target.value})} required maxLength="120" /></label>
        <label>Nomor HP penerima<input value={address.recipientPhone} onChange={(event)=>setAddress({...address,recipientPhone:event.target.value})} required maxLength="30" /></label>
        <label className={styles.full}>Alamat jalan, nomor, RT/RW<input value={address.addressLine} onChange={(event)=>setAddress({...address,addressLine:event.target.value})} required minLength="8" maxLength="1000" /></label>
        <label className={styles.full}>Cari kelurahan / kecamatan / kota<input value={regionQuery} onChange={(event)=>findRegions(event.target.value)} minLength="3" autoComplete="off" /></label>
        {regions.length > 0 && <div className={styles.regionList}>{regions.map((region,index)=><button type="button" key={`${region.area_id}-${index}`} onClick={()=>chooseRegion(region)}>{region.name}</button>)}</div>}
        <div className={styles.regionSummary}>{address.areaId ? `${address.areaName}, ${address.districtName}, ${address.cityName}, ${address.provinceName} · ${address.zipcode} · area ${address.areaId}` : 'Pilih satu hasil pencarian wilayah.'}</div>
        <label>Koordinat (opsional)<input value={address.coordinate} onChange={(event)=>setAddress({...address,coordinate:event.target.value})} maxLength="80" placeholder="(-6.21,106.81)" /></label>
        <label className={styles.defaultCheck}><input type="checkbox" checked={address.isDefault} onChange={(event)=>setAddress({...address,isDefault:event.target.checked})} /> Jadikan alamat utama</label>
        <button className={styles.button} disabled={!address.areaId}>{editingId ? 'Simpan perubahan' : 'Simpan alamat'}</button>
      </form>
    </section>}
    {(error || message) && <p className={error ? styles.error : styles.notice} role={error ? 'alert' : 'status'}>{error || message}</p>}
  </div>;
}
