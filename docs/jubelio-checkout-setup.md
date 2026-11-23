# Checkout Tripay + Jubelio Shipment

## Keamanan dan prasyarat

- Password database yang pernah dilampirkan di percakapan harus dirotasi di Aiven. Perbarui hanya `.env` lokal; jangan kirim secret baru lewat chat dan jangan commit `.env`.
- Verifikasi database Aiven yang dipilih memang database marketplace Comotrade, lalu buat backup sebelum migrasi.
- Jangan gunakan nama/variabel `NEXT_PUBLIC_*` untuk Jubelio, Tripay, cookie session, atau kredensial database.
- Isi `.env` lokal dari `.env.example`. `AUTH_SECRET` harus berupa nilai acak minimal 32 karakter. Untuk akses Jubelio gunakan URL sandbox dan kredensial yang dibuat di Developer dashboard setelah tersedia.
- Shipment memerlukan data origin gudang yang valid: nama, telepon, alamat, kode pos; isi area ID/koordinat bila tersedia.
- Untuk API resmi, gunakan `JUBELIO_BASE_URL=https://api-shipment.jubelio.com` (production) atau `https://api-shipment.sandbox.jubelio.com` (staging/sandbox). Pastikan environment URL sesuai dengan environment kredensial.

## Migrasi MySQL

Untuk database baru yang sengaja sudah dihapus manual, gunakan `my.sql` sebagai skrip final tunggal. File tersebut membuat schema `CLAUDE_PROJECTS` bila belum ada, membuat semua tabel termasuk struktur Jubelio/account, lalu memasukkan akun admin dan produk contoh. Pastikan nama schema di file sama dengan `DB_NAME` pada `.env` lokal dan user database memiliki izin membuat schema. File tidak berisi perintah `DROP`; backup dan penghapusan harus dilakukan manual dan terpisah.

Jangan gunakan `my.sql` pada database lama yang masih berisi data karena skrip hanya membuat objek yang belum ada dan tidak meng-upgrade tabel yang sudah ada. Untuk database lama, backup lalu tinjau/terapkan migrasi incremental `db/migrations/003_jubelio_shipping_and_account.sql` secara manual. Jangan menjalankannya dari `npm run db:migrate`; runner saat ini hanya mengelola baseline dan enhancement akun.

Akun sample: username `admin`, email `admin@comotrade.local`, password sementara `TempAdmin!Change2026`. Ganti password tersebut segera setelah login pertama dan sebelum aplikasi bisa diakses publik.

Produk yang sudah ada mendapat nilai berat/dimensi `NULL`. Administrator harus mengisi berat per unit dalam gram dan panjang/lebar/tinggi dalam cm sebelum produk dapat memperoleh tarif kurir atau dibeli lewat checkout. Pastikan ukuran mencakup kemasan yang benar.

## Menjalankan mock lokal

1. Terminal PowerShell pertama: masuk ke `jubelio-ecommerce-starter`, set URL webhook mock ke route Next, lalu jalankan mock:

	```powershell
	$env:MOCK_WEBHOOK_URL = 'http://localhost:3000/api/webhooks/jubelio'
	npm run mock
	```
2. Pada root `.env` lokal, set `JUBELIO_BASE_URL=http://localhost:4010`, client ID/secret ke nilai mock starter, dan `JUBELIO_WEBHOOK_SECRET` ke secret mock. Kredensial contoh hanya untuk mock lokal.
3. Terminal kedua di root Comotrade: jalankan `npm run dev`. Login, tambahkan alamat dengan pencarian wilayah, pastikan produk memiliki data paket, lalu ke keranjang → konfirmasi → pilih tarif.
4. Tripay baru dapat membuka pembayaran setelah key sandbox dan channel `TRIPAY_PAYMENT_METHOD` lokal terisi. Jika belum, order tersimpan dan bisa dilanjutkan dari halaman akun setelah konfigurasi tersedia.

## Alur operasional

- Harga, stok, berat, dimensi, alamat, dan tarif diperiksa server-side. `expectedCarrierPrice` dari browser hanya pembanding; nilainya tidak dipakai sebagai harga final.
- Tripay menerima total termasuk ongkir yang dibayar pelanggan. Callback Tripay tetap menjadi sumber kebenaran status pembayaran.
- Admin membuat resi setelah pembayaran berstatus `paid`. Jika create timeout, state menjadi `UNKNOWN`; jangan membuat resi kedua sampai admin memeriksa dashboard Jubelio dan menyelesaikannya.
- Webhook diverifikasi dari raw body menggunakan formula contoh kontrak Jubelio (`HMAC-SHA256(secret, rawBody + secret)`), disimpan, dibalas cepat, lalu diproses.
- Rekonsiliasi hanya tersedia untuk admin. Status shipment yang masuk hanya dipetakan lewat fungsi `applyStatusUpdate` di `lib/jubelio-shipping.js`.
- Saldo wallet pada profil adalah ledger pelanggan Comotrade, tidak terkait saldo Jubelio Wallet perusahaan. Kredit/debit manual yang tersedia hanya untuk admin dan harus memiliki alasan.

## Batasan sebelum produksi

Kontrak Jubelio yang tersedia masih referensi v1.8 dan integrasi belum diuji ke sandbox/production asli. Konfirmasi signature, `ref_no`, `items[].value`, premi asuransi, COD, rate limit, dan perilaku timeout ke Jubelio. Harga COD sengaja tidak diaktifkan karena checkout ini memakai Tripay dan kontrak belum memastikan nominal COD.

Payment gateway dan courier tidak dapat diverifikasi end-to-end tanpa credential/provider yang valid. Gunakan mock lokal untuk alur Shipment; jangan menjalankan test yang mengakses DB nyata sebelum migrasi, backup, dan credential rotation dipastikan.
