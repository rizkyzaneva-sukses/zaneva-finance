import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Fallback hanya agar `prisma generate` bisa jalan saat build Docker (belum ada DB).
    // Migrate/seed/aplikasi tetap butuh DATABASE_URL asli; entrypoint memeriksanya.
    url: process.env.DATABASE_URL ?? "postgresql://build:build@localhost:5432/build",
  },
});
