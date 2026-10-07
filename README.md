# Zaneva Finance

Aplikasi rekap keuangan multi-rekening untuk tim Zaneva. Upload mutasi bank
(screenshot atau PDF) → AI membacanya dan menyarankan kode akun → tim mengoreksi →
tersimpan jadi rekap permanen dengan history dan dashboard.

Sebelumnya bernama *Zaneva Mutasi*: tool parsing stateless tanpa database.
Lihat [PRD-zaneva-mutasi-v2.md](PRD-zaneva-mutasi-v2.md) untuk rancangan lengkap v2,
dan [PRD-zaneva-mutasi.md](PRD-zaneva-mutasi.md) untuk versi lama.

## Fitur

- **Multi-user** dengan 4 role: OWNER, ADMIN (= Finance), STAFF, BENDAHARA. Matriks lengkap ada di
  halaman **Panduan** → tab *Penjelasan tiap Role*
- **Alur ACC** — koreksi oleh STAFF/BENDAHARA menandai transaksi "Menunggu ACC" (badge); ADMIN/OWNER
  yang menyetujui. Transaksi yang menunggu ACC tetap ikut laporan (asumsi, lihat Panduan)
- **Petty cash** — jenis rekening sendiri, kelompok sendiri di Neraca (bukan Harta), tapi diperlakukan
  seperti kas. BENDAHARA hanya melihat dan menginput transaksi petty cash
- **Input transaksi manual** dari halaman Transaksi
- **Alokasi dari laba** — OWNER menutup buku laba bersih bulan lalu, ADMIN/OWNER mendistribusikan ke
  kode alokasi sesuai persen (diatur di Kode Akun); saldo = jatah dari laba − pemakaian lewat mutasi
- **Dokumen** — unggah screenshot/PDF mutasi per rekening. File dihapus otomatis dari server setelah
  3 hari (`DOKUMEN_RETENSI_HARI`), catatannya tetap permanen
- **Stok & HPP** — master produk multi-brand (SKU, Brand, HPP) dengan mass edit HPP lewat template
  Excel, dan stok opname (Persediaan Awal sekali, lalu SO Bulanan). Nilai persediaan = stok × HPP,
  HPP dikunci saat SO disimpan. Dipakai Laporan: Persediaan di Neraca, dan **599 Selisih HPP**
  (persediaan awal − akhir) di Laba Rugi. File yang salah ditampilkan di pop up per baris, dengan
  Excel baris gagal untuk diperbaiki
- **Dashboard per brand** — filter Brand di Dashboard (saldo rekening brand itu, cash flow, breakdown), ringkasan laba
  bulan lalu dan bulan berjalan, persediaan terkini, dan tabel perbandingan antar brand
- **Laporan per brand** — rekening diberi brand; laporan bisa difilter per brand (rekening milik brand
  itu + persediaan brand itu) atau semua brand
- **Log Aktivitas** (OWNER) — siapa mengubah/menghapus apa, dengan data sebelum dan sesudah
- **Panduan** — Quick Start, Tanya Jawab, Workflow, dan penjelasan tiap role di dalam aplikasi
- **Rekap** — upload screenshot mutasi bank apa pun (BCA, Mandiri, BRI, BNI) atau
  PDF e-Statement Mandiri, diparsing jadi baris transaksi
- **Saran kode akun otomatis** dari chart of accounts internal (146 kode), bisa
  dikoreksi tim sebelum disimpan
- **Anti-duplikat** — baris yang sudah pernah masuk di-skip otomatis dan dilaporkan
- **Saldo berjalan** dihitung sistem dari saldo awal, dibandingkan dengan saldo yang
  tertulis di mutasi bank untuk rekonsiliasi
- **Dashboard** — saldo per rekening, cash flow masuk vs keluar, breakdown per kode
  akun, dan daftar baris yang belum beres
- **Laporan** — Laba Rugi, Neraca, Arus Kas, dan Perubahan Modal (basis kas), dihitung dari
  transaksi dan kode akun. Transaksi yang tidak punya kode, atau kodenya belum diatur masuk
  laporan apa, ditampung di "Belum diklasifikasi" dengan peringatan, jadi Neraca selalu seimbang
  dan tidak ada uang yang hilang diam-diam. Tab Laporan juga punya kotak **Pemeriksaan** yang
  membandingkan kas laporan dengan saldo tersimpan per transaksi
- **Split transaksi** — satu transaksi bank dipecah ke beberapa kode akun
- **Export Excel** format `No. | Tanggal | Kode | Keterangan | Uang masuk | Uang keluar | Saldo | Catatan`
- Light + dark mode, mengikuti OS dan bisa di-override

## Jalankan lokal

Butuh PostgreSQL yang sudah jalan.

```bash
npm install
cp .env.example .env     # lalu isi DATABASE_URL, SESSION_SECRET, OPENROUTER_API_KEY
```

Buat role & database (sekali saja, butuh akses superuser PostgreSQL):

```sql
CREATE ROLE zaneva_app WITH LOGIN PASSWORD 'ganti-passwordnya';
ALTER ROLE zaneva_app CREATEDB;   -- dibutuhkan prisma migrate dev untuk shadow database
CREATE DATABASE zaneva_finance OWNER zaneva_app;
```

Lalu:

```bash
npx prisma migrate dev     # bikin tabel
npx prisma db seed         # isi 146 kode akun + user admin
npm run dev
```

Buka http://localhost:3000, login dengan `admin` / `admin123`
(atau nilai `SEED_ADMIN_PASSWORD` di `.env`). **Ganti password ini setelah login pertama.**

### Data dummy untuk mencoba Laporan

```bash
npm run db:dummy         # buat 3 rekening "[DUMMY]" berisi ±125 transaksi Jul–Okt 2026
npm run db:dummy:hapus   # hapus semuanya
```

Skrip ini hanya menyentuh rekening berawalan `[DUMMY]`; datamu tidak disentuh. Menjalankan
`db:dummy` lagi membuat ulang datanya dari awal.

### Setup awal setelah login

1. Buka **Pengguna** → ganti password admin, buat akun untuk tiap anggota tim.
2. Buka **Rekening** → tambahkan tiap rekening beserta saldo awal dan tanggalnya.
   Ini titik nol pembukuan — kalau salah, seluruh saldo ikut salah.
3. Buka **Kode Akun** → sesuaikan chart of accounts kalau perlu.
4. Mulai merekap dari halaman **Rekap**.

## Environment variables

| Key | Keterangan |
|---|---|
| `DATABASE_URL` | Koneksi PostgreSQL. Karakter khusus di password harus di-URL-encode (`@` → `%40`) |
| `SESSION_SECRET` | Minimal 32 karakter, untuk enkripsi cookie session |
| `SEED_ADMIN_PASSWORD` | Password user OWNER pertama saat seed (default `admin123`) |
| `OPENROUTER_API_KEY` | API key dari [openrouter.ai](https://openrouter.ai), dipakai untuk OCR & saran kode akun |
| `OPENROUTER_MODEL` | Model vision, default `google/gemini-2.5-flash` |
| `DOKUMEN_DIR` | Folder penyimpanan file Dokumen (default `./storage/dokumen`). **Di server arahkan ke volume persisten** |
| `DOKUMEN_RETENSI_HARI` | Lama file Dokumen disimpan sebelum dihapus otomatis (default 3) |

## Cara kerja

**Screenshot (semua bank).** Gambar dikirim ke OpenRouter dengan satu prompt generik
lintas bank — bukan prompt khusus per bank. Hasilnya baris transaksi dengan tanggal,
keterangan, arah uang, nominal, dan saldo kalau ditampilkan. Baris yang AI ragu
membacanya ditandai dan tidak pernah dibuang diam-diam.

**PDF Mandiri.** Teks diekstrak langsung dengan `pdfjs-dist` (mendukung password),
disusun ulang jadi tabel berdasarkan posisi kolom. Bank lain belum punya parser PDF —
pakai mode screenshot dulu.

**Saran kode akun** jalan sebagai tahap terpisah setelah parsing (teks saja, tanpa
gambar). Dipisah supaya akurasi tiap tahap tidak saling mengganggu, bisa dihitung
ulang tanpa OCR ulang, dan jauh lebih murah. Kode yang disarankan AI ditandai
`saran AI` sampai ada manusia yang mengonfirmasi.

**Saldo** dihitung sistem: `saldo[n] = saldo[n-1] + masuk − keluar`, dimulai dari
saldo awal rekening. Saldo yang terbaca di mutasi bank disimpan terpisah hanya
sebagai pembanding — kalau selisihnya ≥ Rp 1, baris itu diberi peringatan.

## Deploy

Lihat [DEPLOY_EASYPANEL.md](DEPLOY_EASYPANEL.md): butuh service PostgreSQL, dan volume persisten
untuk Dokumen. Container menjalankan `prisma migrate deploy` + seed otomatis saat start
(tidak butuh izin `CREATEDB`).

## Yang belum dikerjakan / keterbatasan

- **Parser PDF hanya untuk Mandiri**, dan dikalibrasi dari satu contoh e-Statement.
  Bank lain menyusul ketika contoh formatnya tersedia.
- **Anti-duplikat bisa salah tolak.** Dua transaksi yang benar-benar kembar (tanggal,
  nominal, dan keterangan sama persis) akan ikut ter-skip. Baris yang ditolak tetap
  ditahan di layar dengan penjelasan dan tombol **Tetap masukkan**, jadi tidak ada yang
  hilang diam-diam.
- **Beberapa kode akun bernama sama persis** (kode 70202–70214 semuanya "Pinjaman
  Internal"), sehingga AI tidak bisa membedakannya dan akan mengosongkan kodenya.
  Perlu nama pembeda. Lihat Open Items di PRD v2.
- Belum ada tes otomatis.
- **Bendahara belum bisa dibatasi per kas.** Semua BENDAHARA melihat semua petty cash.
- **Belum ada kunci bulan.** Setelah bulan ditutup bukunya, transaksi lama masih bisa diubah; kalau laba
  berubah, Alokasi hanya memberi peringatan, snapshot jatah tidak ikut berubah.
- **Pemakaian dana alokasi di Laporan** diperlakukan sebagai pengurang ekuitas (Neraca dan Perubahan Modal)
  dan aktivitas Pendanaan (Arus Kas), BUKAN beban Laba Rugi, supaya tidak mengurangi laba yang jadi dasar
  alokasi. Ini asumsi; bisa diubah per kode di Kode Akun kalau pembukuan Anda beda.
- **Dokumen tidak otomatis terhubung ke Rekap** — diunggah terpisah.
- **OCR hanya diuji dengan gambar sintetis**, dan parser PDF Mandiri belum diuji ulang setelah refactor v2.
- **Brand dihubungkan lewat rekening.** Transaksi tidak punya brand sendiri; kalau satu rekening dipakai
  beberapa brand, semua transaksinya masuk ke satu brand. Rekening tanpa brand hanya muncul di "Semua brand".
- **Persediaan tidak muncul di laporan per rekening** (stok tidak terbagi per rekening).
- **Kode 103 Persediaan Barang Dagang vs SO:** kalau transaksi bank masih memakai 103 padahal SO dipakai,
  barang terhitung dobel. Laporan memberi peringatan; pembelian barang sebaiknya ke kode 5xx.
- **SO yang menunggu ACC tetap dihitung** di laporan (sama seperti transaksi menunggu ACC).
- **Tutup buku Alokasi sebaiknya setelah SO akhir bulan diunggah.** Kalau belum, Selisih HPP belum masuk
  laba; Alokasi memberi peringatan tapi tidak memblokir.
