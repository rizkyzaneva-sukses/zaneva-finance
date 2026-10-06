-- CreateTable
CREATE TABLE "TransaksiRincian" (
    "id" TEXT NOT NULL,
    "transaksiId" TEXT NOT NULL,
    "kodeAkunId" TEXT NOT NULL,
    "nominal" DECIMAL(18,2) NOT NULL,
    "keterangan" TEXT,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransaksiRincian_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransaksiRincian_transaksiId_idx" ON "TransaksiRincian"("transaksiId");

-- CreateIndex
CREATE INDEX "TransaksiRincian_kodeAkunId_idx" ON "TransaksiRincian"("kodeAkunId");

-- AddForeignKey
ALTER TABLE "TransaksiRincian" ADD CONSTRAINT "TransaksiRincian_transaksiId_fkey" FOREIGN KEY ("transaksiId") REFERENCES "Transaksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransaksiRincian" ADD CONSTRAINT "TransaksiRincian_kodeAkunId_fkey" FOREIGN KEY ("kodeAkunId") REFERENCES "KodeAkun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
