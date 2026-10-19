'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';

export default function AuthForm({ mode }) {
  const isRegister = mode === 'register';
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Autentikasi gagal.');
      router.replace(data.user.role === 'admin' ? '/admin' : '/account');
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
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={10} maxLength={72} required /></label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.submit} disabled={busy}>{busy ? 'Memproses…' : isRegister ? 'Daftar' : 'Login'}</button>
        </form>
        <div className={styles.divider}><span>ATAU</span></div>
        <button className={styles.google} type="button" disabled title="Integrasi Google OAuth ditambahkan setelah konfigurasi OAuth tersedia">Lanjutkan dengan Google · segera tersedia</button>
        <p className={styles.switch}>{isRegister ? 'Sudah memiliki akun?' : 'Belum memiliki akun?'}{' '}<Link href={isRegister ? '/login' : '/register'}>{isRegister ? 'Login' : 'Daftar'}</Link></p>
        <p className={styles.note}>Akun baru otomatis memiliki akses user. Hak admin hanya berasal dari kolom role database.</p>
      </section>
    </main>
  );
}
