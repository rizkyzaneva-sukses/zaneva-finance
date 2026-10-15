-- Satu Simpan Semua di Rekap bisa dipindah sekaligus ke rekening lain.
ALTER TABLE "Transaksi" ADD COLUMN "batchId" TEXT;
CREATE INDEX "Transaksi_batchId_idx" ON "Transaksi"("batchId");

-- Unggahan awal tidak mengantri ACC Finance. Antrean yang ada sekarang
-- berasal dari aturan yang salah (semua simpan rekap ikut mengantri).
-- Koreksi setelah data tersimpan akan masuk antrean lagi.
UPDATE "Transaksi"
SET "statusAcc" = 'DISETUJUI'
WHERE "statusAcc" = 'PERLU_FINANCE';
