import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function run() {
  const brands = await prisma.brand.findMany({
    include: {
      _count: {
        select: {
          pertumbuhanBisnis: true,
          rekening: true,
          produk: true,
          soItem: true,
          penugasan: true,
        }
      }
    }
  });
  console.log("Brands in DB:");
  for (const b of brands) {
    console.log(`- ID: ${b.id} | Nama: "${b.nama}" | Kunci: "${b.kunci}" | Pertumbuhan: ${b._count.pertumbuhanBisnis} | Rekening: ${b._count.rekening} | Produk: ${b._count.produk}`);
  }
}

run().finally(() => process.exit(0));
