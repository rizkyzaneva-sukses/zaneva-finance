-- Jurnal penyesuaian per brand. Tidak menempel ke rekening, jadi saldo bank tidak berubah.
CREATE TABLE "JurnalPenyesuaian" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "tanggal" DATE NOT NULL,
  "nomor" INTEGER NOT NULL,
  "keterangan" TEXT NOT NULL,
  "dibalik" BOOLEAN NOT NULL DEFAULT false,
  "pembalikDariId" TEXT,
  "dibuatOlehId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JurnalPenyesuaian_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JurnalPenyesuaian_brandId_nomor_key" ON "JurnalPenyesuaian"("brandId", "nomor");
CREATE UNIQUE INDEX "JurnalPenyesuaian_pembalikDariId_key" ON "JurnalPenyesuaian"("pembalikDariId");
CREATE INDEX "JurnalPenyesuaian_brandId_tanggal_idx" ON "JurnalPenyesuaian"("brandId", "tanggal");

ALTER TABLE "JurnalPenyesuaian" ADD CONSTRAINT "JurnalPenyesuaian_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JurnalPenyesuaian" ADD CONSTRAINT "JurnalPenyesuaian_pembalikDariId_fkey"
  FOREIGN KEY ("pembalikDariId") REFERENCES "JurnalPenyesuaian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JurnalPenyesuaian" ADD CONSTRAINT "JurnalPenyesuaian_dibuatOlehId_fkey"
  FOREIGN KEY ("dibuatOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "JurnalPenyesuaianBaris" (
  "id" TEXT NOT NULL,
  "jurnalId" TEXT NOT NULL,
  "kodeAkunId" TEXT NOT NULL,
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "kredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "urutan" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "JurnalPenyesuaianBaris_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JurnalPenyesuaianBaris_jurnalId_idx" ON "JurnalPenyesuaianBaris"("jurnalId");
CREATE INDEX "JurnalPenyesuaianBaris_kodeAkunId_idx" ON "JurnalPenyesuaianBaris"("kodeAkunId");

ALTER TABLE "JurnalPenyesuaianBaris" ADD CONSTRAINT "JurnalPenyesuaianBaris_jurnalId_fkey"
  FOREIGN KEY ("jurnalId") REFERENCES "JurnalPenyesuaian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JurnalPenyesuaianBaris" ADD CONSTRAINT "JurnalPenyesuaianBaris_kodeAkunId_fkey"
  FOREIGN KEY ("kodeAkunId") REFERENCES "KodeAkun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
