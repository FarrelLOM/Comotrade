'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './account-home.module.css';

const sections = [
  { href: '/account/profile', number: '01', title: 'Profil', detail: 'Informasi pribadi dan kontak', mark: '↗' },
  { href: '/account/addresses', number: '02', title: 'Alamat', detail: 'Penerima dan lokasi pengiriman', mark: '↗' },
  { href: '/account/wallet', number: '03', title: 'Wallet', detail: 'Saldo dan catatan transaksi', mark: '↗' },
  { href: '/account/orders', number: '04', title: 'Pesanan', detail: 'Pembayaran dan pelacakan', mark: '↗' },
  { href: '/account/messages', number: '05', title: 'Pesan', detail: 'Percakapan dengan tim toko', mark: '↗' },
];

export default function AccountHome() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [addressCount, setAddressCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/profile', { cache: 'no-store' }).then(async (response) => ({ response, data: await response.json() })),
      fetch('/api/addresses', { cache: 'no-store' }).then(async (response) => ({ response, data: await response.json() })),
    ]).then(([profileResult, addressResult]) => {
      if (!active) return;
      if (profileResult.response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent('/account')}`);
        return;
      }
      if (!profileResult.response.ok) throw new Error(profileResult.data.error || 'Ringkasan akun belum tersedia.');
      if (!addressResult.response.ok) throw new Error(addressResult.data.error || 'Alamat akun belum tersedia.');
      setProfile(profileResult.data.user);
      setWallet(profileResult.data.wallet);
      setAddressCount(addressResult.data.addresses?.length || 0);
    }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [router]);

  return <main className={`${styles.page} commerce-surface`}>
    <header className={styles.topbar}><Link href="/" className={styles.wordmark}>COMOTRADE <span>· ACCOUNT</span></Link><Link href="/cart" className={styles.cart}>Keranjang ↗</Link></header>
    <section className={styles.intro}>
      <div><span className={styles.kicker}>PRIVATE CLIENT AREA</span><h1>{profile ? `Selamat datang, ${profile.full_name.split(' ')[0]}` : 'Akun Anda'}</h1><p>Ruang personal untuk mengelola pesanan, pengiriman, dan detail akun.</p></div>
      <div className={styles.member}><span>MEMBER</span><strong>{profile?.role === 'admin' ? 'Administrator' : profile?.username || 'Memuat akun'}</strong><small>{profile?.email || ' '}</small></div>
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <section className={styles.summary} aria-label="Ringkasan akun">
      <div><span>WALLET COMOTRADE</span><strong>{wallet ? new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(wallet.balance || 0) : '—'}</strong><small>Bukan saldo Jubelio Wallet toko</small></div>
      <div><span>ALAMAT TERSIMPAN</span><strong>{addressCount.toString().padStart(2,'0')}</strong><small>Pilihan pengiriman Anda</small></div>
      <div><span>AKUN</span><strong>{profile?.role === 'admin' ? 'ADMIN' : 'PERSONAL'}</strong><small>{profile?.phone || 'Nomor telepon belum diisi'}</small></div>
    </section>
    <section className={styles.menu} aria-label="Menu akun">
      <div className={styles.menuTitle}><span>ACCOUNT SERVICES</span><span>2026 / COMOTRADE</span></div>
      {sections.map((section) => <Link href={section.href} className={styles.menuRow} key={section.href}>
        <span className={styles.number}>{section.number}</span><span className={styles.menuText}><strong>{section.title}</strong><small>{section.detail}</small></span><span className={styles.mark}>{section.mark}</span>
      </Link>)}
    </section>
    <footer className={styles.footer}><span>COMOTRADE · NUSANTARA GOODS</span><button className={styles.logoutButton} onClick={async()=>{const response=await fetch('/api/auth/logout',{method:'POST'});if(!response.ok){setError('Tidak dapat keluar dari akun. Coba lagi.');return;}router.replace('/');router.refresh();}}>↗ Keluar dari akun</button></footer>
  </main>;
}
