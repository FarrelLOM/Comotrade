'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './marketplace-chrome.module.css';

const asset = (name) => `/Pictures/asset/${encodeURIComponent(name)}`;

export default function MarketplaceChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [user, setUser] = useState(null);
  const isHome = pathname === '/';
  const isPayment = pathname.startsWith('/payment') ||
    pathname.startsWith('/checkout') ||
    pathname === '/account';
  const [returnTo, setReturnTo] = useState(pathname);

  useEffect(() => {
    setReturnTo(`${pathname}${window.location.search}`);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (active && response.ok) setUser(data.user || null);
      })
      .catch((error) => {
        console.error('Could not check marketplace session:', error);
        if (active) setUser(null);
      });
    return () => { active = false; };
  }, [pathname]);

  if (isHome) return null;

  function submitSearch(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    router.push(`/${params.size ? `?${params.toString()}` : ''}`);
  }

  return (
    <header className={`${styles.header} ${isPayment ? styles.logoOnly : ''}`}>
      {!isPayment && (
        <>
          <form className={styles.search} onSubmit={submitSearch} role="search">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari rempah dan produk..." aria-label="Cari produk" />
            <button type="submit" aria-label="Cari produk">
              <span className={styles.searchGlyph} aria-hidden="true" />
            </button>
          </form>
          <Link href="/" className={styles.wordmark} aria-label="Ke beranda produk">
            <img src={asset('tulisan.png')} alt="Comarket" />
          </Link>
          <nav className={styles.actions} aria-label="Navigasi marketplace">
            <Link href="/?filters=open" className={styles.iconButton} aria-label="Filter produk" title="Lihat kategori">
              <img src={asset('filter icon.png')} alt="" />
            </Link>
            <Link href="/?sort=ascending" className={styles.iconButton} aria-label="Urutkan produk" title="Urutkan produk di katalog">
              <img src={asset('sort icon.png')} alt="" />
            </Link>
            <Link href="/cart" className={styles.iconButton} aria-label="Keranjang">
              <img src={asset('cart icon.png')} alt="" />
            </Link>
            {user ? (
              <Link href={user.role === 'admin' ? '/admin' : '/account'} className={styles.profile} aria-label="Profil saya">
                <img src={asset('identity.png')} alt="" />
              </Link>
            ) : (
              <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className={styles.login}>Login</Link>
            )}
          </nav>
        </>
      )}
      {isPayment && (
        <Link href="/" className={styles.wordmark} aria-label="Ke beranda produk">
          <img src={asset('tulisan.png')} alt="Comarket" />
        </Link>
      )}
    </header>
  );
}
