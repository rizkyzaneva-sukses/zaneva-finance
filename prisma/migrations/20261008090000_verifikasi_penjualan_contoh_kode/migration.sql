-- Verifikasi penjualan kode 400 (kosong = belum) dan ingatan koreksi kode akun.
ALTER TABLE "Transaksi" ADD COLUMN "diverifikasiPada" TIMESTAMP(3);
ALTER TABLE "Transaksi" ADD COLUMN "diverifikasiOlehId" TEXT;

ALTER TABLE "Transaksi" ADD CONSTRAINT "Transaksi_diverifikasiOlehId_fkey"
  FOREIGN KEY ("diverifikasiOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Transaksi_diverifikasiPada_idx" ON "Transaksi"("diverifikasiPada");

CREATE TABLE "ContohKlasifikasi" (
  "id" TEXT NOT NULL,
  "kunci" TEXT NOT NULL,
  "arah" TEXT NOT NULL,
  "kodeAkunId" TEXT NOT NULL,
  "jumlah" INTEGER NOT NULL DEFAULT 1,
  "terakhirPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContohKlasifikasi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContohKlasifikasi_kunci_arah_key" ON "ContohKlasifikasi"("kunci", "arah");
CREATE INDEX "ContohKlasifikasi_kodeAkunId_idx" ON "ContohKlasifikasi"("kodeAkunId");

ALTER TABLE "ContohKlasifikasi" ADD CONSTRAINT "ContohKlasifikasi_kodeAkunId_fkey"
  FOREIGN KEY ("kodeAkunId") REFERENCES "KodeAkun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
