-- CreateEnum
CREATE TYPE "Laporan" AS ENUM ('NERACA', 'LABA_RUGI', 'TIDAK_ADA');

-- AlterTable
ALTER TABLE "KodeAkun" ADD COLUMN     "laporan" "Laporan";
