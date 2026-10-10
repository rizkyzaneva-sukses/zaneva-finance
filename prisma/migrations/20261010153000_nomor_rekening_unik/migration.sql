-- Nama rekening boleh sama. Yang unik adalah nomor rekening.
-- Spasi di nomor yang sudah tersimpan dibuang dulu, supaya "123 456" dan "123456" tidak lolos sebagai dua nomor.
UPDATE "Rekening"
SET "nomorRekening" = NULLIF(regexp_replace("nomorRekening", '\s+', '', 'g'), '');

DROP INDEX "Rekening_nama_key";

CREATE UNIQUE INDEX "Rekening_nomorRekening_key" ON "Rekening"("nomorRekening");
