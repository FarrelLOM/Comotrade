# Setup backend Comotrade

Backend memakai MySQL 8+, Next.js Route Handlers, dan variabel server-side dari `.env`.
Jangan menambahkan prefix `NEXT_PUBLIC_` pada kredensial database, Tripay, Google OAuth,
atau `AUTH_SECRET`.

## Database MySQL

1. Pastikan `.env` menunjuk ke host, port, pengguna, dan database MySQL yang memang
   disediakan untuk Comotrade.
2. Koneksi TLS aktif secara default (`DB_SSL=true`). Jika penyedia database memberi
   sertifikat CA khusus—seperti Aiven—unduh CA dari halaman layanan database dan simpan
   di lokasi lokal yang tidak masuk Git, misalnya `certs/database-ca.pem`. Atur
   `DB_SSL_CA=./certs/database-ca.pem`. Aplikasi tetap memvalidasi sertifikat server;
   jangan menonaktifkan validasi TLS untuk mengatasi error sertifikat.
3. Cadangkan database dan pastikan targetnya benar sebelum menjalankan migrasi:

   ```powershell
   npm run db:migrate
   ```

   Schema awal MySQL dibaca dari `my.sql`; enhancement untuk database yang sudah ada
   dijalankan oleh `scripts/migrate.mjs`. Tabel pelacakan `schema_migrations` mencegah
   migrasi yang sama dijalankan berulang kali. Schema awal menambahkan contoh Cabai
   Kering (Rp50.000/kg, stok 1.000 kg) hanya jika produk tersebut belum ada. Migrasi
   tidak menghapus tabel atau data.
4. Jika tabel lama sudah ada tetapi strukturnya tidak sesuai, skrip akan berhenti dan
   menyebut kolom yang hilang. Buat cadangan, tinjau struktur lama, lalu siapkan migrasi
   kompatibilitas tersendiri; `CREATE TABLE IF NOT EXISTS` tidak mengubah tabel lama.
5. Setelah membuat akun admin melalui registrasi, ubah role akun itu menjadi `admin`
   secara manual pada database. Registrasi publik dan Google OAuth selalu membuat role
   `user`.

Variabel database yang diperlukan: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
`DB_NAME`, `DB_SSL`, dan—bila CA khusus diperlukan—`DB_SSL_CA`.

## Google OAuth

Alur server-side sudah menggunakan authorization code, cookie `state` HTTP-only,
pertukaran kode di server, dan Google OpenID Connect UserInfo. Email Google harus
terverifikasi. Akun yang sudah ada dengan email sama hanya ditautkan jika email tersebut
terverifikasi Google; role yang sudah ada tidak dinaikkan.

Isi konfigurasi berikut setelah membuat OAuth Client ID bertipe Web:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` — harus persis sama dengan Authorized redirect URI di Google
  Cloud Console, yaitu `https://domain-anda/api/auth/google/callback` setelah deploy.
- `APP_URL` — origin situs, misalnya `https://domain-anda`.

Untuk pengembangan lokal, tambahkan URL callback localhost ke daftar Authorized redirect
URIs. Jangan mengirim secret OAuth ke browser.

## Tripay

Integrasi memakai endpoint transaksi Tripay, HMAC-SHA256 untuk pembuatan transaksi,
dan HMAC-SHA256 atas raw body untuk memverifikasi callback pembayaran. Callback hanya
mengubah pesanan menjadi `paid` setelah signature, merchant reference, reference
transaksi, dan jumlah pembayaran cocok. Pemrosesan callback idempoten.

Atur nilai server-side berikut dari dashboard merchant Tripay:

- `TRIPAY_MODE=sandbox` selama uji coba, lalu `production` ketika siap live.
- `TRIPAY_API_KEY`, `TRIPAY_PRIVATE_KEY`, dan `TRIPAY_MERCHANT_CODE`.
- `TRIPAY_PAYMENT_METHOD` dengan kode channel yang aktif pada merchant, misalnya kode
  channel yang disediakan Tripay untuk akun tersebut.
- `TRIPAY_CALLBACK_URL=https://domain-anda/api/payments/tripay/callback` setelah domain
  HTTPS tersedia.
- `APP_URL=https://domain-anda` untuk URL kembali setelah pembayaran.

Pembayaran baru dimulai dari akun setelah checkout. Pesanan dan stok disimpan sebelum
pengguna diarahkan ke halaman pembayaran Tripay. Status berubah menjadi lunas melalui
callback terverifikasi, bukan dari parameter URL browser. Refund belum memanggil API
refund Tripay; status refund harus ditangani sesuai prosedur merchant.

## Alur data utama

- Login email/password: bcrypt dan cookie sesi HTTP-only bertanda tangan.
- Login Google: Google OAuth, lalu sesi aplikasi yang sama.
- Produk: CRUD admin melalui API; penghapusan produk dilakukan dengan menonaktifkan
  produk, bukan menghapus riwayat transaksi.
- Checkout: harga dibaca ulang dari database, stok dikunci dan dikurangi dalam transaksi
  MySQL, lalu pesanan dan catatan pembayaran dibuat.
- Pesanan: akses dibatasi untuk pemilik atau admin. Pembatalan hanya diizinkan sebelum
  proses pengiriman dan mengembalikan stok dalam transaksi.
- Ulasan hanya bisa dibuat pemilik pesanan yang berstatus delivered.
- Pesan dukungan tersimpan di database dan dimuat ulang saat dashboard dimuat; belum
  menggunakan koneksi real-time.
- Keranjang masih disimpan di browser sampai checkout.

## Catatan operasional

Sebelum produksi, siapkan domain HTTPS dan allowlist callback di Google/Tripay; gunakan
credential produksi Tripay hanya setelah pengujian sandbox; rotasi password database
atau secret yang pernah terekspos; dan rencanakan rate limiting, audit log, notifikasi,
backup rutin, serta pengujian integrasi terhadap database staging.
