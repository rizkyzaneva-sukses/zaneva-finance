-- Role: VIEWER dihapus, BENDAHARA ditambah.
-- Postgres tidak bisa menghapus nilai enum, jadi tipe dibuat ulang.
-- Aman karena tidak ada user ber-role VIEWER (dicek sebelum migrasi); kalau ada,
-- cast di bawah akan gagal dan migrasi berhenti tanpa mengubah apa pun.
CREATE TYPE "Role_new" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'BENDAHARA');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STAFF';
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- Bank: tambah PETTY_CASH (kas tunai, diperlakukan seperti rekening)
ALTER TYPE "Bank" ADD VALUE 'PETTY_CASH' BEFORE 'LAINNYA';

-- ACC pencatatan oleh ADMIN/OWNER
CREATE TYPE "StatusAcc" AS ENUM ('DISETUJUI', 'MENUNGGU');

ALTER TABLE "Transaksi"
  ADD COLUMN "statusAcc" "StatusAcc" NOT NULL DEFAULT 'DISETUJUI',
  ADD COLUMN "accOlehId" TEXT,
  ADD COLUMN "accPada" TIMESTAMP(3);

CREATE INDEX "Transaksi_statusAcc_idx" ON "Transaksi"("statusAcc");

ALTER TABLE "Transaksi"
  ADD CONSTRAINT "Transaksi_accOlehId_fkey"
  FOREIGN KEY ("accOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
