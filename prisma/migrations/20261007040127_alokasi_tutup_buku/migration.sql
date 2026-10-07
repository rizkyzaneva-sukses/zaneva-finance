-- AlterTable
ALTER TABLE "KodeAkun" ADD COLUMN     "saldoAwalAlokasi" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PeriodeLaba" (
    "id" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "labaBersih" DECIMAL(18,2) NOT NULL,
    "disetujuiOlehId" TEXT NOT NULL,
    "disetujuiPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodeLaba_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistribusiAlokasi" (
    "id" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "kodeAkunId" TEXT NOT NULL,
    "persen" DECIMAL(5,2) NOT NULL,
    "nominal" DECIMAL(18,2) NOT NULL,
    "disetujuiOlehId" TEXT NOT NULL,
    "disetujuiPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistribusiAlokasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeriodeLaba_tahun_bulan_key" ON "PeriodeLaba"("tahun", "bulan");

-- CreateIndex
CREATE INDEX "DistribusiAlokasi_kodeAkunId_idx" ON "DistribusiAlokasi"("kodeAkunId");

-- CreateIndex
CREATE UNIQUE INDEX "DistribusiAlokasi_periodeId_kodeAkunId_key" ON "DistribusiAlokasi"("periodeId", "kodeAkunId");

-- AddForeignKey
ALTER TABLE "PeriodeLaba" ADD CONSTRAINT "PeriodeLaba_disetujuiOlehId_fkey" FOREIGN KEY ("disetujuiOlehId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistribusiAlokasi" ADD CONSTRAINT "DistribusiAlokasi_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "PeriodeLaba"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistribusiAlokasi" ADD CONSTRAINT "DistribusiAlokasi_kodeAkunId_fkey" FOREIGN KEY ("kodeAkunId") REFERENCES "KodeAkun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistribusiAlokasi" ADD CONSTRAINT "DistribusiAlokasi_disetujuiOlehId_fkey" FOREIGN KEY ("disetujuiOlehId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
