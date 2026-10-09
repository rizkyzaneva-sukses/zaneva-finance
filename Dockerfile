# syntax=docker/dockerfile:1
# Next.js standalone — untuk EasyPanel (Build Method: Dockerfile, Port 3000)
# Butuh PostgreSQL terpisah (DATABASE_URL). Migrasi + seed dijalankan otomatis saat container start.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Hanya untuk prisma generate saat build. URL asli diisi EasyPanel saat container jalan.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
# "build" menjalankan prisma generate dulu (src/generated tidak ikut git)
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV HOME=/tmp
# Volume EasyPanel dipasang di /data. Tanpa env ini file dokumen jatuh di dalam image.
ENV DOKUMEN_DIR=/data/dokumen
RUN apk add --no-cache openssl su-exec \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nextjs -u 1001 \
  && mkdir -p /data/dokumen \
  && chown -R nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# node_modules penuh supaya migrate + seed (prisma CLI dan tsx) jalan di dalam container.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
