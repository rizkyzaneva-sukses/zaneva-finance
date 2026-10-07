#!/bin/sh
# Jalan tiap container start: terapkan migrasi, isi data awal (idempotent), lalu start app.
set -e
[ -n "$DATABASE_URL" ] || { echo "[entrypoint] DATABASE_URL belum diisi"; exit 1; }
echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy
echo "[entrypoint] seed data awal"
npx prisma db seed
echo "[entrypoint] start server"
exec node server.js
