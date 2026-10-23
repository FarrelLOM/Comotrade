# Comotrade — Rempah Nusantara

Marketplace Next.js untuk katalog produk, akun pelanggan/admin, checkout, pembayaran
Tripay, dan autentikasi Google OAuth. Backend menggunakan MySQL 8+.

## Mulai development

1. Salin `.env.example` menjadi `.env`, lalu isi kredensial MySQL dan `AUTH_SECRET`.
2. Jika penyedia database memerlukan CA khusus, simpan sertifikat secara lokal dan atur
   `DB_SSL_CA` ke path sertifikat tersebut.
3. Setelah memastikan database target dan membuat cadangan, siapkan skema:

   ```powershell
   npm run db:migrate
   ```

4. Jalankan aplikasi:

   ```powershell
   npm run dev
   ```

Buka `http://localhost:3000`. Petunjuk konfigurasi Google OAuth, Tripay, TLS, dan database
ada di [docs/backend-setup.md](./docs/backend-setup.md).

## Teknologi

- Next.js App Router dan React
- MySQL dengan transaksi untuk checkout dan pengelolaan stok
- bcrypt untuk password dan sesi bertanda tangan dalam cookie HTTP-only
- Google OAuth 2.0 / OpenID Connect
- Tripay dengan validasi signature callback
