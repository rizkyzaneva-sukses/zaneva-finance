-- CreateEnum
CREATE TYPE "JenisSo" AS ENUM ('AWAL', 'BULANAN');

-- AlterTable
ALTER TABLE "Rekening" ADD COLUMN     "brandId" TEXT;

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kunci" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produk" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "skuKunci" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "hpp" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StokOpname" (
    "id" TEXT NOT NULL,
    "jenis" "JenisSo" NOT NULL,
    "tanggalInput" DATE NOT NULL,
    "posisiPada" DATE NOT NULL,
    "catatan" TEXT,
    "jumlahSku" INTEGER NOT NULL DEFAULT 0,
    "totalStok" INTEGER NOT NULL DEFAULT 0,
    "totalNilai" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "statusAcc" "StatusAcc" NOT NULL DEFAULT 'DISETUJUI',
    "accOlehId" TEXT,
    "accPada" TIMESTAMP(3),
    "diunggahOlehId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StokOpname_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StokOpnameItem" (
    "id" TEXT NOT NULL,
    "stokOpnameId" TEXT NOT NULL,
    "produkId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "stok" INTEGER NOT NULL,
    "hpp" DECIMAL(18,2) NOT NULL,
    "nilai" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "StokOpnameItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_nama_key" ON "Brand"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_kunci_key" ON "Brand"("kunci");

-- CreateIndex
CREATE UNIQUE INDEX "Produk_skuKunci_key" ON "Produk"("skuKunci");

-- CreateIndex
CREATE INDEX "Produk_brandId_idx" ON "Produk"("brandId");

-- CreateIndex
CREATE INDEX "StokOpname_posisiPada_idx" ON "StokOpname"("posisiPada");

-- CreateIndex
CREATE INDEX "StokOpnameItem_brandId_idx" ON "StokOpnameItem"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "StokOpnameItem_stokOpnameId_produkId_key" ON "StokOpnameItem"("stokOpnameId", "produkId");

-- AddForeignKey
ALTER TABLE "Rekening" ADD CONSTRAINT "Rekening_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produk" ADD CONSTRAINT "Produk_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokOpname" ADD CONSTRAINT "StokOpname_accOlehId_fkey" FOREIGN KEY ("accOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokOpname" ADD CONSTRAINT "StokOpname_diunggahOlehId_fkey" FOREIGN KEY ("diunggahOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokOpnameItem" ADD CONSTRAINT "StokOpnameItem_stokOpnameId_fkey" FOREIGN KEY ("stokOpnameId") REFERENCES "StokOpname"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokOpnameItem" ADD CONSTRAINT "StokOpnameItem_produkId_fkey" FOREIGN KEY ("produkId") REFERENCES "Produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokOpnameItem" ADD CONSTRAINT "StokOpnameItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
