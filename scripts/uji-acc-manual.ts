/**
 * Uji aturan ACC untuk input MANUAL.
 *
 * Membuktikan: input manual oleh STAFF/BENDAHARA masuk antrean ACC Finance,
 * sementara hasil unggahan mutasi bank dan input ADMIN/OWNER tetap DISETUJUI.
 *
 * Dijalankan di container: npx tsx scripts/uji-acc-manual.ts
 */
import { fieldAccUntukInput } from "../src/lib/acc";
import { Bank, Role } from "../src/generated/prisma/enums";

type Kasus = {
  nama: string;
  role: Role;
  sumber?: string;
  harap: string;
};

const kasus: Kasus[] = [
  // Input MANUAL oleh STAFF (Dea) → harus menunggu Finance.
  { nama: "STAFF input MANUAL", role: Role.STAFF, sumber: "MANUAL", harap: "PERLU_FINANCE" },
  { nama: "BENDAHARA input MANUAL", role: Role.BENDAHARA, sumber: "MANUAL", harap: "PERLU_FINANCE" },
  // Unggahan mutasi bank → langsung sah, angkanya terbukti dokumen bank.
  { nama: "STAFF upload SCREENSHOT", role: Role.STAFF, sumber: "SCREENSHOT", harap: "DISETUJUI" },
  { nama: "STAFF upload PDF", role: Role.STAFF, sumber: "PDF", harap: "DISETUJUI" },
  // Finance menginput sendiri → dia yang memutuskan.
  { nama: "ADMIN input MANUAL", role: Role.ADMIN, sumber: "MANUAL", harap: "DISETUJUI" },
  { nama: "OWNER input MANUAL", role: Role.OWNER, sumber: "MANUAL", harap: "DISETUJUI" },
];

let lulus = 0;
let gagal = 0;
console.log("=== UJI ATURAN ACC INPUT MANUAL ===");
for (const k of kasus) {
  const hasil = fieldAccUntukInput({ id: "u1", role: k.role }, Bank.BCA, k.sumber);
  const benar = hasil.statusAcc === k.harap;
  if (benar) lulus += 1;
  else gagal += 1;
  console.log(
    `${benar ? "LULUS" : "GAGAL"}  ${k.nama.padEnd(26)} -> ${hasil.statusAcc}` +
      (benar ? "" : `  (harap ${k.harap})`)
  );
}
console.log("");
console.log(`Lulus: ${lulus}  Gagal: ${gagal}`);
if (gagal > 0) process.exitCode = 1;
