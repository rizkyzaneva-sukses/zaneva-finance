-- CreateEnum
CREATE TYPE "AktivitasKas" AS ENUM ('OPERASI', 'INVESTASI', 'PENDANAAN', 'PINDAH_DANA');

-- AlterTable
ALTER TABLE "KodeAkun" ADD COLUMN     "aktivitasKas" "AktivitasKas";
