import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buatClient() {
  // Dibaca saat pertama dipakai, bukan saat modul di-import. `next build` memuat
  // route tanpa DATABASE_URL; kalau nilainya diambil lewat process.env.DATABASE_URL
  // biasa, bundler bisa menempelkan URL palsu dari waktu build ke image produksi.
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diisi di environment variable");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function ambil(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = buatClient();
  return globalForPrisma.prisma;
}

// Proxy supaya pemanggilan yang sudah ada (`prisma.user...`) tetap jalan,
// tanpa membuat koneksi pada saat file ini di-import.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = ambil();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
