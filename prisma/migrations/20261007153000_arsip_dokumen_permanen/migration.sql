-- Arsip Dokumen Mutasi disimpan selamanya. File yang masih ada tidak lagi kedaluwarsa.
ALTER TABLE "DokumenMutasi" ALTER COLUMN "kedaluwarsaPada" DROP NOT NULL;

UPDATE "DokumenMutasi"
SET "kedaluwarsaPada" = NULL
WHERE "fileDihapusPada" IS NULL;
