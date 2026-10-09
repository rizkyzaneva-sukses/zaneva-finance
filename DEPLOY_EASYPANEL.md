# Deploy ke EasyPanel

Zaneva Finance butuh **PostgreSQL** dan **satu volume persisten** (untuk file Dokumen).
Migrasi database dan seed data awal dijalankan otomatis oleh container setiap start
(`docker-entrypoint.sh`), jadi tidak ada langkah manual untuk skema.

File yang dipakai EasyPanel hanya satu: `Dockerfile` di root repo. Saat container hidup,
>`docker-entrypoint.sh` menunggu Postgres, menjalankan migrasi, mengisi data awal, lalu menyalakan aplikasi di port 3000.

## 1. Push ke GitHub
```bash
git push origin master
```
Pastikan `.env` **tidak** ikut ter-commit (sudah ada di `.gitignore`).

## 2. Buat database PostgreSQL
EasyPanel → New Service → **Postgres**. Catat user, password, nama database, dan host internalnya
(biasanya `<nama-project>_<nama-service>`).

`DATABASE_URL` formatnya:
```
postgresql://USER:PASSWORD@HOST:5432/NAMA_DB?schema=public
```
Karakter khusus di password harus di-URL-encode (`@` → `%40`, `#` → `%23`).

## 3. Buat App
New Service → **App** → Source: GitHub → pilih repo
- Build Method: **Dockerfile**
- Port: **3000**
- **Environment** (lihat `.env.example`):

| Key | Isi |
|---|---|
| `DATABASE_URL` | dari langkah 2 |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SEED_ADMIN_PASSWORD` | password awal user `admin` (OWNER). **Isi dengan yang kuat**, jangan biarkan default |
| `APP_BASE_URL` | `https://mutasi.mrrizky.my.id` |
| `NEXT_PUBLIC_APP_NAME` | `Zaneva Finance` |
| `OPENROUTER_API_KEY` | API key dari openrouter.ai |
| `OPENROUTER_MODEL` | default `google/gemini-2.5-flash` |
| `DOKUMEN_DIR` | sudah `/data/dokumen` di image. Isi lagi hanya kalau foldernya beda |

## 4. Volume untuk Dokumen (WAJIB)
App → **Mounts** → tambah **Volume**, mount path `/data`.
Tanpa ini file Dokumen hilang setiap container dibuat ulang (catatannya di database tetap ada).

## 5. Domain
EasyPanel → Domains → `mutasi.mrrizky.my.id` → arahkan ke port 3000.

## 6. Login pertama
Login `admin` dengan `SEED_ADMIN_PASSWORD`. Seed hanya membuat user `admin` kalau belum ada,
jadi mengubah variabel ini setelahnya **tidak** mengganti password. Ganti lewat halaman Pengguna.

Lalu ikuti "Setup awal setelah login" di README (rekening + saldo awal, pengguna, kode akun).

## Update berikutnya
Push ke GitHub → EasyPanel → Deploy. Migrasi baru ikut berjalan otomatis saat container start.

## Backup
Database dan volume `/data` adalah satu-satunya data. Aktifkan backup Postgres di EasyPanel.
Arsip Dokumen disimpan permanen, jadi volume `/data` wajib ikut dibackup.

## Kalau bermasalah
| Gejala | Cek |
|---|---|
| Build gagal | Lihat log build, biasanya TypeScript error |
| Container restart terus | Log: `DATABASE_URL belum diisi` atau gagal konek DB. Cek host/password, dan password di-URL-encode |
| Login gagal terus | Seed hanya membuat `admin` sekali. Password yang berlaku adalah saat pertama seed jalan |
| Upload besar gagal | Total unggah maks 100MB; kalau lewat reverse proxy lain, cek batas body-nya |
| File Dokumen hilang setelah deploy | Volume `/data` belum dipasang, atau `DOKUMEN_DIR` tidak mengarah ke sana |
| Parsing gagal / error OpenRouter | `OPENROUTER_API_KEY` valid & ada saldo? |
| Parsing Mandiri gagal "Password PDF salah" | Password e-Statement yang diisi di form |
| Halaman blank / 500 | Cek log container — biasanya env var kurang |
