-- Sesi lama batal ketika password diganti.
ALTER TABLE "User" ADD COLUMN "tokenSesi" INTEGER NOT NULL DEFAULT 0;
