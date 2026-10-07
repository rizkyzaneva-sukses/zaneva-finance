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
# "build" menjalankan prisma generate dulu (src/generated tidak ikut git)
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl && addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Untuk migrate + seed saat start: CLI prisma, tsx, dan klien hasil generate
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

# Folder dokumen; di EasyPanel pasang Volume ke /data lalu set DOKUMEN_DIR=/data/dokumen
RUN mkdir -p /data/dokumen && chown -R nextjs:nodejs /data && chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["./docker-entrypoint.sh"]
