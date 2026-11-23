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
  const [sessionLoading, setSessionLoading] = useState(true);
  const isHome = pathname === '/';
  const isAccount = pathname === '/account' || pathname.startsWith('/account/');
  const isPayment = pathname.startsWith('/payment') ||
    pathname.startsWith('/checkout') ||
    isAccount;
  const [returnTo, setReturnTo] = useState(pathname);

  useEffect(() => {
    setReturnTo(`${pathname}${window.location.search}`);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    if (isHome || isAccount) {
      setSessionLoading(false);
      return () => { active = false; };
    }
    async function refreshSession() {
      setSessionLoading(true);
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await response.json();
        if (active) setUser(response.ok ? data.user || null : null);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setSessionLoading(false);
      }
    }
    const handleSessionChange = () => { refreshSession(); };
    refreshSession();
    window.addEventListener('comotrade:session-changed', handleSessionChange);
    return () => {
      active = false;
      window.removeEventListener('comotrade:session-changed', handleSessionChange);
    };
  }, [isAccount, isHome, pathname]);

  if (isHome || isAccount) return null;

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
            {sessionLoading ? (
              <span className={styles.login} aria-live="polite">Memuat akun…</span>
            ) : user ? (
              <Link href={user.role === 'admin' ? '/admin' : '/account'} className={styles.profile} aria-label="Profil saya">
                <img src={asset('identity.png')} alt="" />
              </Link>
            ) : (
              <Link
                href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
                className={styles.login}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  const currentPage = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                  router.push(`/login?returnTo=${encodeURIComponent(currentPage)}`);
                }}
              >Login</Link>
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
