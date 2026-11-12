-- CreateTable
CREATE TABLE "PertumbuhanBisnis" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "detailBank" JSONB,
    "cashOnBank" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "kasBesar" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "kasKecil" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cashOnHand" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "piutangVendor" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "utangVendor" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstandingShopeeLazada" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstandingSap" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstandingJnt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstandingTiktok" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstandingLainnya" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "inventory" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "selisihInventory" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pertumbuhanNominal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pertumbuhanPersen" DECIMAL(10,4),
    "hutangLainnya" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "keteranganHutang" TEXT,
    "catatan" TEXT,
    "dibuatOlehId" TEXT,
    "diubahOlehId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PertumbuhanBisnis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PertumbuhanBisnis_tahun_bulan_idx" ON "PertumbuhanBisnis"("tahun", "bulan");

-- CreateIndex
CREATE UNIQUE INDEX "PertumbuhanBisnis_brandId_tahun_bulan_key" ON "PertumbuhanBisnis"("brandId", "tahun", "bulan");

-- AddForeignKey
ALTER TABLE "PertumbuhanBisnis" ADD CONSTRAINT "PertumbuhanBisnis_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PertumbuhanBisnis" ADD CONSTRAINT "PertumbuhanBisnis_dibuatOlehId_fkey" FOREIGN KEY ("dibuatOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PertumbuhanBisnis" ADD CONSTRAINT "PertumbuhanBisnis_diubahOlehId_fkey" FOREIGN KEY ("diubahOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
