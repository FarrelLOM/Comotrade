'use client';

import Link from 'next/link';
import AccountDetails from './AccountDetails';
import styles from './account-section.module.css';

const labels = { profile: 'Profil', addresses: 'Alamat pengiriman', wallet: 'Wallet', orders: 'Pesanan', messages: 'Pesan' };
const paths = [
  ['/account/profile','Profil'],['/account/addresses','Alamat'],['/account/wallet','Wallet'],
  ['/account/orders','Pesanan'],['/account/messages','Pesan'],
];

export default function AccountSection({ view, children }) {
  return <main className={`${styles.page} commerce-surface`}>
    <header className={styles.header}><div><Link href="/account" className={styles.back}>Akun saya /</Link><p className={styles.kicker}>ACCOUNT SERVICES</p><h1>{labels[view]}</h1></div><Link href="/cart" className={styles.cart}>Keranjang ↗</Link></header>
    <nav className={styles.nav} aria-label="Menu akun">{paths.map(([href,label])=><Link className={href===`/account/${view}`?styles.active:''} href={href} key={href}>{label}</Link>)}</nav>
    {children || <AccountDetails view={view} />}
  </main>;
}
