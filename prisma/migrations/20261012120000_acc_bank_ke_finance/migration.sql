-- Mutasi bank yang diunggah STAFF tidak lagi menunggu Bendahara.
-- Bendahara hanya mencatat petty cash dan tidak meng-ACC rekening bank.
-- Baris transaksi yang masih MENUNGGU dipindah ke antrean Finance.
-- Stok opname memakai tabel sendiri, jadi tidak ikut terubah.
UPDATE "Transaksi"
SET "statusAcc" = 'PERLU_FINANCE'
WHERE "statusAcc" = 'MENUNGGU';
