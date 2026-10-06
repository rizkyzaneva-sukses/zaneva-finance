# Deploy ke EasyPanel

App ini **stateless** — tidak ada database yang perlu dibuat.

## 1. Push ke GitHub
```bash
git init && git add . && git commit -m "initial commit"
git remote add origin <url-repo>
git push -u origin master
```
Pastikan `.env` **tidak** ikut ter-commit (sudah ada di `.gitignore`).

## 2. Buat App di EasyPanel
New Service → **App** → Source: GitHub → pilih repo
- Build Method: **Dockerfile**
- Port: **3000**
- Isi environment variables (lihat `.env.example`):
  - `APP_PASSWORD` — password login
  - `SESSION_SECRET` — generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - `APP_BASE_URL` — `https://mutasi.mrrizky.my.id`
  - `NEXT_PUBLIC_APP_NAME` — `Zaneva Mutasi`
  - `OPENROUTER_API_KEY` — API key dari openrouter.ai
  - `OPENROUTER_MODEL` — default `google/gemini-2.5-flash`, bisa diganti kapan saja tanpa redeploy ulang kode

## 3. Domain
EasyPanel → Domains → `mutasi.mrrizky.my.id` → arahkan ke port 3000.

## 4. Login pertama
Masuk dengan `APP_PASSWORD` yang sudah diisi di environment variable.

## Update berikutnya
Push ke GitHub → EasyPanel → Deploy. Tidak ada migrasi database.

## Kalau bermasalah
| Gejala | Cek |
|---|---|
| Build gagal | Lihat log build, biasanya TypeScript error |
| Login gagal terus | `APP_PASSWORD` sudah diisi di environment? |
| Parsing BNI gagal / error OpenRouter | `OPENROUTER_API_KEY` valid & masih ada kuota/saldo di OpenRouter? |
| Parsing Mandiri gagal "Password PDF salah" | Password yang diisi di form sesuai dengan password e-Statement asli |
| Halaman blank / 500 | Cek log container — biasanya env var kurang |
