import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface RincianMasuk {
  kodeAkunId?: unknown;
  nominal?: unknown;
  keterangan?: unknown;
}

export interface RincianBersih {
  kodeAkunId: string;
  nominal: Prisma.Decimal;
  keterangan: string | null;
  urutan: number;
}

/**
 * Validasi rincian split terhadap total transaksi induknya.
 *
 * Total semua rincian HARUS persis sama dengan nominal transaksi di bank —
 * kalau tidak, laporan per kode akun tidak akan cocok dengan saldo rekening.
 */
export async function validasiRincian(
  total: Prisma.Decimal,
  masuk: RincianMasuk[]
): Promise<{ ok: true; rincian: RincianBersih[] } | { ok: false; error: string }> {
  if (masuk.length < 2) {
    return { ok: false, error: "Split butuh minimal 2 rincian" };
  }

  const bersih: RincianBersih[] = [];
  for (const [i, r] of masuk.entries()) {
    const kodeAkunId = String(r.kodeAkunId ?? "");
    if (!kodeAkunId) {
      return { ok: false, error: `Rincian ke-${i + 1}: kode akun wajib dipilih` };
    }

    let nominal: Prisma.Decimal;
    try {
      nominal = new Prisma.Decimal(String(r.nominal ?? ""));
    } catch {
      return { ok: false, error: `Rincian ke-${i + 1}: nominal tidak valid` };
    }
    if (!nominal.isFinite() || nominal.lte(0)) {
      return { ok: false, error: `Rincian ke-${i + 1}: nominal harus lebih dari 0` };
    }
    if (nominal.decimalPlaces() > 2) {
      return { ok: false, error: `Rincian ke-${i + 1}: nominal maksimal 2 angka di belakang koma` };
    }

    bersih.push({
      kodeAkunId,
      nominal,
      keterangan: String(r.keterangan ?? "").trim() || null,
      urutan: i,
    });
  }

  const jumlah = bersih.reduce((s, r) => s.plus(r.nominal), new Prisma.Decimal(0));
  if (!jumlah.equals(total)) {
    const selisih = total.minus(jumlah);
    return {
      ok: false,
      error: `Total rincian ${jumlah.toFixed(2)} tidak sama dengan transaksi aslinya ${total.toFixed(2)} (${
        selisih.gt(0) ? "kurang" : "lebih"
      } ${selisih.abs().toFixed(2)})`,
    };
  }

  const idKode = [...new Set(bersih.map((r) => r.kodeAkunId))];
  const ada = await prisma.kodeAkun.count({ where: { id: { in: idKode } } });
  if (ada !== idKode.length) {
    return { ok: false, error: "Ada kode akun di rincian yang tidak ditemukan" };
  }

  return { ok: true, rincian: bersih };
}
