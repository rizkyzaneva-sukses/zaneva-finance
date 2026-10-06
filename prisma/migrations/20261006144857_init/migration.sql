-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "Bank" AS ENUM ('BCA', 'MANDIRI', 'BRI', 'BNI', 'LAINNYA');

-- CreateEnum
CREATE TYPE "Kelompok" AS ENUM ('HARTA', 'UTANG', 'MODAL', 'PENDAPATAN', 'PEMBELIAN', 'BEBAN', 'PINJAMAN', 'ALOKASI', 'LAINNYA');

-- CreateEnum
CREATE TYPE "StatusKode" AS ENUM ('KOSONG', 'SARAN_AI', 'DIKONFIRMASI');

-- CreateEnum
CREATE TYPE "Sumber" AS ENUM ('SCREENSHOT', 'PDF', 'MANUAL');

-- CreateEnum
CREATE TYPE "AksiAudit" AS ENUM ('BUAT', 'UBAH', 'HAPUS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rekening" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "bank" "Bank" NOT NULL,
    "nomorRekening" TEXT,
    "saldoAwal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tanggalSaldoAwal" DATE NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rekening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KodeAkun" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kelompok" "Kelompok" NOT NULL,
    "sistem" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KodeAkun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaksi" (
    "id" TEXT NOT NULL,
    "rekeningId" TEXT NOT NULL,
    "kodeAkunId" TEXT,
    "tanggal" DATE NOT NULL,
    "urutanInput" INTEGER NOT NULL DEFAULT 0,
    "keterangan" TEXT NOT NULL,
    "uangMasuk" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "uangKeluar" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saldoBank" DECIMAL(18,2),
    "catatan" TEXT,
    "statusKode" "StatusKode" NOT NULL DEFAULT 'KOSONG',
    "sumber" "Sumber" NOT NULL DEFAULT 'SCREENSHOT',
    "yakin" BOOLEAN NOT NULL DEFAULT true,
    "dedupeHash" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entitas" TEXT NOT NULL,
    "entitasId" TEXT NOT NULL,
    "aksi" "AksiAudit" NOT NULL,
    "dataLama" JSONB,
    "dataBaru" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Rekening_nama_key" ON "Rekening"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "KodeAkun_kode_key" ON "KodeAkun"("kode");

-- CreateIndex
CREATE INDEX "Transaksi_rekeningId_tanggal_urutanInput_idx" ON "Transaksi"("rekeningId", "tanggal", "urutanInput");

-- CreateIndex
CREATE INDEX "Transaksi_kodeAkunId_idx" ON "Transaksi"("kodeAkunId");

-- CreateIndex
CREATE INDEX "Transaksi_statusKode_idx" ON "Transaksi"("statusKode");

-- CreateIndex
CREATE UNIQUE INDEX "Transaksi_rekeningId_dedupeHash_key" ON "Transaksi"("rekeningId", "dedupeHash");

-- CreateIndex
CREATE INDEX "AuditLog_entitas_entitasId_idx" ON "AuditLog"("entitas", "entitasId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Transaksi" ADD CONSTRAINT "Transaksi_rekeningId_fkey" FOREIGN KEY ("rekeningId") REFERENCES "Rekening"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaksi" ADD CONSTRAINT "Transaksi_kodeAkunId_fkey" FOREIGN KEY ("kodeAkunId") REFERENCES "KodeAkun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaksi" ADD CONSTRAINT "Transaksi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaksi" ADD CONSTRAINT "Transaksi_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
