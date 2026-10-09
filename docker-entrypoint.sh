#!/bin/sh
# Jalan sebagai root, lalu proses aplikasi turun ke user nextjs.
# Migrasi dan seed idempotent, aman dijalankan setiap container start.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] DATABASE_URL belum diisi"
  exit 1
fi

dokumen="${DOKUMEN_DIR:-/data/dokumen}"
mkdir -p "$dokumen"
chown -R nextjs:nodejs /data

echo "[entrypoint] menunggu database"
i=0
until su-exec nextjs node -e "const {Client}=require('pg'); const c=new Client({connectionString:process.env.DATABASE_URL}); c.connect().then(()=>c.end()).then(()=>process.exit(0)).catch(()=>process.exit(1))"
do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[entrypoint] database tidak siap setelah 30 percobaan"
    exit 1
  fi
  echo "[entrypoint] database belum siap ($i/30)"
  sleep 2
done

echo "[entrypoint] prisma migrate deploy"
su-exec nextjs npx --no-install prisma migrate deploy

echo "[entrypoint] seed data awal"
su-exec nextjs npx --no-install prisma db seed

echo "[entrypoint] start server"
exec su-exec nextjs node server.js
