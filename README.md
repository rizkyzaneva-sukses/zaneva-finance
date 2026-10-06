# Zaneva Finance

Aplikasi rekap keuangan multi-rekening untuk tim Zaneva. Upload mutasi bank
(screenshot atau PDF) → AI membacanya dan menyarankan kode akun → tim mengoreksi →
tersimpan jadi rekap permanen dengan history dan dashboard.

Sebelumnya bernama *Zaneva Mutasi*: tool parsing stateless tanpa database.
Lihat [PRD-zaneva-mutasi-v2.md](PRD-zaneva-mutasi-v2.md) untuk rancangan lengkap v2,
dan [PRD-zaneva-mutasi.md](PRD-zaneva-mutasi.md) untuk versi lama.

## Fitur

- **Multi-user** dengan 4 role: OWNER, ADMIN, STAFF, VIEWER
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
  dan tidak ada uang yang hilang diam-diam
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

Lihat [DEPLOY_EASYPANEL.md](DEPLOY_EASYPANEL.md). Di produksi pakai
`prisma migrate deploy` (tidak butuh izin `CREATEDB`).

## Yang belum dikerjakan / keterbatasan

- **Parser PDF hanya untuk Mandiri**, dan dikalibrasi dari satu contoh e-Statement.
  Bank lain menyusul ketika contoh formatnya tersedia.
- **Anti-duplikat bisa salah tolak.** Dua transaksi yang benar-benar kembar (tanggal,
  nominal, dan keterangan sama persis) akan ikut ter-skip. Baris yang ditolak tetap
  ditahan di layar dengan penjelasan dan tombol **Tetap masukkan**, jadi tidak ada yang
  hilang diam-diam.
- **Belum ada UI untuk menambah transaksi manual.** Endpoint-nya ada
  (`POST /api/transaksi`) tapi belum dipasang tombolnya di halaman Transaksi.
- **Beberapa kode akun bernama sama persis** (kode 70202–70214 semuanya "Pinjaman
  Internal"), sehingga AI tidak bisa membedakannya dan akan mengosongkan kodenya.
  Perlu nama pembeda. Lihat Open Items di PRD v2.
- Belum ada tes otomatis.
