# Zaneva Mutasi

Tool internal untuk mengubah mutasi rekening bank jadi file Excel (.xlsx):

- **BNI** — screenshot/foto mutasi (gambar) → diparsing via OpenRouter (AI vision)
- **Mandiri** — e-Statement PDF berpassword → diparsing langsung dari teks (tanpa AI)

Stateless: tidak ada database, tidak ada data yang disimpan di server. Upload → proses → download.

## Jalankan lokal

```bash
npm install
cp .env.example .env   # lalu isi APP_PASSWORD, SESSION_SECRET, OPENROUTER_API_KEY
npm run dev
```

Buka http://localhost:3000, login dengan `APP_PASSWORD` yang diisi di `.env`.

## Environment variables

Lihat [.env.example](.env.example). Yang wajib diisi:

| Key | Keterangan |
|---|---|
| `APP_PASSWORD` | Password login satu-satunya (single user) |
| `SESSION_SECRET` | Minimal 32 karakter, untuk enkripsi cookie session |
| `OPENROUTER_API_KEY` | API key dari [openrouter.ai](https://openrouter.ai) |
| `OPENROUTER_MODEL` | Model vision OpenRouter, default `google/gemini-2.5-flash` — ganti kapan saja tanpa ubah kode |

## Cara kerja

**BNI**: gambar dikirim ke OpenRouter dengan prompt terstruktur, hasilnya baris transaksi
dengan kolom `TANGGAL | URAIAN TRANSAKSI | (kosong) | TYPE | JUMLAH PEMBAYARAN | SALDO`.
Baris yang menurut AI tidak yakin terbaca (gambar buram/terpotong) ditandai merah di preview
dan bisa dihapus manual sebelum download.

**Mandiri**: teks PDF diekstrak langsung (dengan password) menggunakan `pdfjs-dist`,
lalu disusun ulang jadi tabel berdasarkan posisi kolom. Hasilnya kolom
`TANGGAL | TRANSAKSI | DEBIT | KREDIT | SALDO`, plus verifikasi otomatis
(Saldo Awal + Kredit − Debit harus sama dengan Saldo Akhir).

## Deploy

Lihat [DEPLOY_EASYPANEL.md](DEPLOY_EASYPANEL.md).

## Yang belum dikerjakan / keterbatasan

- Parser Mandiri dikembangkan & diuji dari satu contoh e-Statement. Kalau ada layout
  Mandiri lain (nama bulan beda, multi-halaman dengan transaksi sangat banyak, dsb.)
  dan hasil parsing meleset, cek dulu warning verifikasi saldo di halaman preview.
- Tidak ada riwayat/log hasil parsing sebelumnya (sesuai permintaan: stateless).
