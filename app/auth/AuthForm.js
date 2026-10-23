'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';

const PHONE_PREFIXES = {
  AU: '+61', BR: '+55', CA: '+1', CN: '+86', DE: '+49', ES: '+34',
  FR: '+33', GB: '+44', ID: '+62', IN: '+91', JP: '+81', KR: '+82',
  MY: '+60', NZ: '+64', PH: '+63', SG: '+65', TH: '+66', US: '+1',
};

export default function AuthForm({ mode }) {
  const isRegister = mode === 'register';
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [returnTo, setReturnTo] = useState('/#katalog-toko');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedReturnTo = params.get('returnTo');
    if (requestedReturnTo?.startsWith('/') &&
        !requestedReturnTo.startsWith('//') &&
        !requestedReturnTo.startsWith('/\\') &&
        !requestedReturnTo.includes('\\')) {
      setReturnTo(requestedReturnTo);
    }
    const reason = params.get('error');
    const messages = {
      google_unconfigured: 'Google OAuth belum dikonfigurasi.',
      google_state: 'Sesi Google OAuth tidak valid. Silakan coba lagi.',
      google_denied: 'Login Google dibatalkan.',
      google_failed: 'Login Google belum dapat diproses.',
    };
    if (messages[reason]) setError(messages[reason]);
  }, []);

  useEffect(() => {
    if (!isRegister || phone) return;
    try {
      const region = new Intl.Locale(navigator.language).region;
      setPhone(PHONE_PREFIXES[region] || '+62');
    } catch {
      setPhone('+62');
    }
  }, [isRegister, phone]);

  useEffect(() => {
    if (!isRegister) return undefined;
    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized)) {
      setUsernameStatus(normalized ? 'Gunakan 3–32 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.' : '');
      return undefined;
    }
    setUsernameStatus('Memeriksa ketersediaan…');
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/auth/username?value=${encodeURIComponent(normalized)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Ketersediaan username tidak dapat diperiksa.');
        setUsernameStatus(data.available ? 'Username tersedia.' : 'Username sudah digunakan.');
      } catch (cause) {
        setUsernameStatus(cause.message || 'Ketersediaan username tidak dapat diperiksa.');
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isRegister, username]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch(`/api/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.get('fullName'),
          username: form.get('username'),
          phone: form.get('phone'),
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Autentikasi gagal.');
      router.replace(data.user.role === 'admin' ? '/admin' : returnTo);
      router.refresh();
    } catch (cause) {
      setError(cause.message || 'Server belum siap. Pastikan database telah disiapkan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.brand} href="/">REMpAH NUSANTARA</Link>
        <span className={styles.eyebrow}>MARKETPLACE</span>
        <h1>{isRegister ? 'Buat akun baru' : 'Selamat datang kembali'}</h1>
        <p className={styles.lead}>{isRegister ? 'Daftar untuk mulai berbelanja.' : 'Masuk dengan akun pelanggan atau administrator.'}</p>
        <form className={styles.form} onSubmit={submit}>
          {isRegister && <label>Nama lengkap<input name="fullName" autoComplete="name" minLength={2} maxLength={120} required /></label>}
          {isRegister && <>
            <label>Username
              <input name="username" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" value={username} onChange={(event) => setUsername(event.target.value)} required />
              {usernameStatus && <small className={usernameStatus.includes('tersedia') ? styles.available : styles.availability} role="status">{usernameStatus}</small>}
            </label>
            <label>Nomor HP <span className={styles.fieldHint}>Prefix awal mengikuti bahasa perangkat, bukan lokasi terverifikasi. Silakan sesuaikan nomor internasional Anda.</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          </>}
          {!isRegister && <label>Username<input name="username" autoComplete="username" autoCapitalize="none" required /></label>}
          <label>Password<input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={10} maxLength={72} required /></label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.submit} disabled={busy || (isRegister && (usernameStatus === 'Username sudah digunakan.' || usernameStatus === 'Memeriksa ketersediaan…'))}>{busy ? 'Memproses…' : isRegister ? 'Daftar' : 'Login'}</button>
        </form>
        <div className={styles.divider}><span>ATAU</span></div>
        <Link className={styles.google} href={`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`}>
          <img src="/Pictures/asset/logo%20Google%20(untuk%20login).png" alt="" />
          Lanjutkan dengan Google
        </Link>
        <p className={styles.switch}>{isRegister ? 'Sudah memiliki akun?' : 'Belum memiliki akun?'}{' '}<Link href={`${isRegister ? '/login' : '/register'}?returnTo=${encodeURIComponent(returnTo)}`}>{isRegister ? 'Login' : 'Daftar'}</Link></p>
        <p className={styles.note}>Akun baru otomatis memiliki akses user. Hak admin hanya berasal dari kolom role database.</p>
      </section>
    </main>
  );
}
