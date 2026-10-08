-- ACC berjenjang: tambah status PERLU_FINANCE.
-- MENUNGGU  = input/koreksi staff, menunggu verifikasi BENDAHARA.
-- PERLU_FINANCE = sudah diverifikasi BENDAHARA, menyentuh kode/catatan/split,
--                 menunggu finalisasi FINANCE (ADMIN/OWNER).
ALTER TYPE "StatusAcc" ADD VALUE IF NOT EXISTS 'PERLU_FINANCE';
