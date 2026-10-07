-- CreateTable
CREATE TABLE "DokumenMutasi" (
    "id" TEXT NOT NULL,
    "rekeningId" TEXT NOT NULL,
    "namaFile" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "ukuran" INTEGER NOT NULL,
    "periode" TEXT,
    "catatan" TEXT,
    "diunggahOlehId" TEXT,
    "diunggahPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kedaluwarsaPada" TIMESTAMP(3) NOT NULL,
    "fileDihapusPada" TIMESTAMP(3),

    CONSTRAINT "DokumenMutasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DokumenMutasi_rekeningId_diunggahPada_idx" ON "DokumenMutasi"("rekeningId", "diunggahPada");

-- CreateIndex
CREATE INDEX "DokumenMutasi_kedaluwarsaPada_fileDihapusPada_idx" ON "DokumenMutasi"("kedaluwarsaPada", "fileDihapusPada");

-- AddForeignKey
ALTER TABLE "DokumenMutasi" ADD CONSTRAINT "DokumenMutasi_rekeningId_fkey" FOREIGN KEY ("rekeningId") REFERENCES "Rekening"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DokumenMutasi" ADD CONSTRAINT "DokumenMutasi_diunggahOlehId_fkey" FOREIGN KEY ("diunggahOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
