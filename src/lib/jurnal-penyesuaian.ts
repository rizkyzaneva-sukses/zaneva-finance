import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit, Kelompok } from "@/generated/prisma/enums";

export interface BarisJurnal {
  kodeAkunId: string;
  debit: number;
  kredit: number;
}

export function parseUang(nilai: unknown): number | null {
  if (typeof nilai === "number") {
    if (!Number.isFinite(nilai) || nilai < 0) return null;
    return Math.round(nilai * 100) / 100;
  }
  const teks = String(nilai ?? "").trim().replace(/\s/g, "");
  if (!teks) return 0;
  let n: number;
  if (teks.includes(",") && teks.includes(".")) n = Number(teks.replace(/\./g, "").replace(",", "."));
  else if (teks.includes(",")) n = Number(teks.replace(",", "."));
  else n = Number(teks);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function bacaBaris(raw: unknown): { ok: true; baris: BarisJurnal[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length < 2) {
    return { ok: false, error: "Minimal dua baris, dan debit harus sama dengan kredit" };
  }
  const baris: BarisJurnal[] = [];
  for (const item of raw) {
    const o = (item ?? {}) as { kodeAkunId?: unknown; debit?: unknown; kredit?: unknown };
    const kodeAkunId = String(o.kodeAkunId ?? "").trim();
    if (!kodeAkunId) return { ok: false, error: "Setiap baris wajib punya kode akun" };
    const debit = parseUang(o.debit);
    const kredit = parseUang(o.kredit);
    if (debit === null || kredit === null) return { ok: false, error: "Nominal tidak valid" };
    if (debit > 0 && kredit > 0) {
      return { ok: false, error: "Satu baris tidak boleh diisi debit dan kredit sekaligus" };
    }
    if (debit === 0 && kredit === 0) return { ok: false, error: "Ada baris yang nominalnya masih nol" };
    if (debit > 1e12 || kredit > 1e12) return { ok: false, error: "Nominal terlalu besar" };
    baris.push({ kodeAkunId, debit, kredit });
  }
  const debitSen = baris.reduce((s, b) => s + Math.round(b.debit * 100), 0);
  const kreditSen = baris.reduce((s, b) => s + Math.round(b.kredit * 100), 0);
  if (debitSen !== kreditSen) return { ok: false, error: "Debit dan kredit harus sama persis" };
  if (debitSen === 0) return { ok: false, error: "Nominal jurnal masih nol" };
  return { ok: true, baris };
}

export function tanggalValid(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Tanggal 1 bulan berikutnya. Dipakai jurnal pembalik akrual. */
export function tanggalPembalik(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const tahun = m === 12 ? y + 1 : y;
  const bulan = m === 12 ? 1 : m + 1;
  return `${tahun}-${String(bulan).padStart(2, "0")}-01`;
}

/** Sisi normal akun. Harta, beban, dan pembelian di debit. */
export function sisiNormal(kelompok: Kelompok): "debit" | "kredit" {
  if (
    kelompok === Kelompok.PENDAPATAN ||
    kelompok === Kelompok.UTANG ||
    kelompok === Kelompok.MODAL ||
    kelompok === Kelompok.PINJAMAN ||
    kelompok === Kelompok.ALOKASI
  ) {
    return "kredit";
  }
  return "debit";
}

function dec(n: number) {
  return new Prisma.Decimal(n.toFixed(2));
}

type Tx = Prisma.TransactionClient;

async function cekKode(tx: Tx, baris: BarisJurnal[]) {
  const ids = [...new Set(baris.map((b) => b.kodeAkunId))];
  const kode = await tx.kodeAkun.findMany({
    where: { id: { in: ids } },
    select: { id: true, kode: true, aktif: true, sistem: true },
  });
  const peta = new Map(kode.map((k) => [k.id, k]));
  for (const id of ids) {
    const k = peta.get(id);
    if (!k) return "Ada kode akun yang tidak ditemukan";
    if (!k.aktif) return `Kode ${k.kode} sudah nonaktif`;
    if (k.sistem) return `Kode ${k.kode} dihitung sistem, tidak dipakai di jurnal penyesuaian`;
  }
  return null;
}

async function tulis(
  tx: Tx,
  input: {
    brandId: string;
    tanggal: string;
    keterangan: string;
    dibalik: boolean;
    baris: BarisJurnal[];
    userId: string;
    pembalikDariId?: string;
  }
) {
  const terakhir = await tx.jurnalPenyesuaian.aggregate({
    where: { brandId: input.brandId },
    _max: { nomor: true },
  });
  const nomor = (terakhir._max.nomor ?? 0) + 1;
  return tx.jurnalPenyesuaian.create({
    data: {
      brandId: input.brandId,
      tanggal: new Date(`${input.tanggal}T00:00:00.000Z`),
      nomor,
      keterangan: input.keterangan,
      dibalik: input.pembalikDariId ? false : input.dibalik,
      pembalikDariId: input.pembalikDariId ?? null,
      dibuatOlehId: input.userId,
      baris: {
        create: input.baris.map((b, i) => ({
          kodeAkunId: b.kodeAkunId,
          debit: dec(b.debit),
          kredit: dec(b.kredit),
          urutan: i,
        })),
      },
    },
    select: { id: true, nomor: true },
  });
}

export async function buatJurnal(input: {
  brandId: string;
  tanggal: string;
  keterangan: string;
  dibalik: boolean;
  baris: BarisJurnal[];
  userId: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const brand = await prisma.brand.findUnique({ where: { id: input.brandId }, select: { id: true } });
  if (!brand) return { ok: false, error: "Brand tidak ditemukan" };

  try {
    const id = await prisma.$transaction(async (tx) => {
      const salah = await cekKode(tx, input.baris);
      if (salah) throw new Error(salah);
      const jurnal = await tulis(tx, input);
      if (input.dibalik) {
        await tulis(tx, {
          ...input,
          tanggal: tanggalPembalik(input.tanggal),
          keterangan: `Pembalik JP-${jurnal.nomor}: ${input.keterangan}`.slice(0, 300),
          dibalik: false,
          pembalikDariId: jurnal.id,
          baris: input.baris.map((b) => ({ kodeAkunId: b.kodeAkunId, debit: b.kredit, kredit: b.debit })),
        });
      }
      await tx.auditLog.create({
        data: {
          userId: input.userId,
          entitas: "JurnalPenyesuaian",
          entitasId: jurnal.id,
          aksi: AksiAudit.BUAT,
          dataBaru: {
            brandId: input.brandId,
            tanggal: input.tanggal,
            keterangan: input.keterangan,
            dibalik: input.dibalik,
            nomor: jurnal.nomor,
          },
        },
      });
      return jurnal.id;
    });
    return { ok: true, id };
  } catch (err) {
    const pesan = err instanceof Error ? err.message : "Gagal menyimpan jurnal";
    if (pesan.startsWith("Kode ") || pesan.startsWith("Ada ")) return { ok: false, error: pesan };
    throw err;
  }
}

export async function ubahJurnal(
  id: string,
  input: {
    brandId: string;
    tanggal: string;
    keterangan: string;
    dibalik: boolean;
    baris: BarisJurnal[];
    userId: string;
  }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const brand = await prisma.brand.findUnique({ where: { id: input.brandId }, select: { id: true } });
  if (!brand) return { ok: false, status: 404, error: "Brand tidak ditemukan" };

  try {
    await prisma.$transaction(async (tx) => {
      const lama = await tx.jurnalPenyesuaian.findUnique({
        where: { id },
        include: { pembalik: { select: { id: true, nomor: true, brandId: true } } },
      });
      if (!lama) throw new Error("TIDAK_ADA");
      if (lama.pembalikDariId) throw new Error("Jurnal pembalik diubah dari jurnal asalnya, bukan dari sini");
      const salah = await cekKode(tx, input.baris);
      if (salah) throw new Error(salah);

      let nomor = lama.nomor;
      if (lama.brandId !== input.brandId) {
        const terakhir = await tx.jurnalPenyesuaian.aggregate({
          where: { brandId: input.brandId },
          _max: { nomor: true },
        });
        nomor = (terakhir._max.nomor ?? 0) + 1;
      }

      await tx.jurnalPenyesuaian.update({
        where: { id },
        data: {
          brandId: input.brandId,
          tanggal: new Date(`${input.tanggal}T00:00:00.000Z`),
          nomor,
          keterangan: input.keterangan,
          dibalik: input.dibalik,
        },
      });
      await tx.jurnalPenyesuaianBaris.deleteMany({ where: { jurnalId: id } });
      await tx.jurnalPenyesuaianBaris.createMany({
        data: input.baris.map((b, i) => ({
          jurnalId: id,
          kodeAkunId: b.kodeAkunId,
          debit: dec(b.debit),
          kredit: dec(b.kredit),
          urutan: i,
        })),
      });

      const barisBalik = input.baris.map((b) => ({
        kodeAkunId: b.kodeAkunId,
        debit: b.kredit,
        kredit: b.debit,
      }));
      const keteranganBalik = `Pembalik JP-${nomor}: ${input.keterangan}`.slice(0, 300);
      if (input.dibalik) {
        if (lama.pembalik) {
          let nomorBalik = lama.pembalik.nomor;
          if (lama.pembalik.brandId !== input.brandId) {
            const lagi = await tx.jurnalPenyesuaian.aggregate({
              where: { brandId: input.brandId },
              _max: { nomor: true },
            });
            nomorBalik = (lagi._max.nomor ?? 0) + 1;
          }
          await tx.jurnalPenyesuaian.update({
            where: { id: lama.pembalik.id },
            data: {
              brandId: input.brandId,
              nomor: nomorBalik,
              tanggal: new Date(`${tanggalPembalik(input.tanggal)}T00:00:00.000Z`),
              keterangan: keteranganBalik,
            },
          });
          await tx.jurnalPenyesuaianBaris.deleteMany({ where: { jurnalId: lama.pembalik.id } });
          await tx.jurnalPenyesuaianBaris.createMany({
            data: barisBalik.map((b, i) => ({
              jurnalId: lama.pembalik!.id,
              kodeAkunId: b.kodeAkunId,
              debit: dec(b.debit),
              kredit: dec(b.kredit),
              urutan: i,
            })),
          });
        } else {
          await tulis(tx, {
            ...input,
            tanggal: tanggalPembalik(input.tanggal),
            keterangan: keteranganBalik,
            dibalik: false,
            pembalikDariId: id,
            baris: barisBalik,
          });
        }
      } else if (lama.pembalik) {
        await tx.jurnalPenyesuaian.delete({ where: { id: lama.pembalik.id } });
      }

      await tx.auditLog.create({
        data: {
          userId: input.userId,
          entitas: "JurnalPenyesuaian",
          entitasId: id,
          aksi: AksiAudit.UBAH,
          dataBaru: {
            brandId: input.brandId,
            tanggal: input.tanggal,
            keterangan: input.keterangan,
            dibalik: input.dibalik,
            nomor,
          },
        },
      });
    });
    return { ok: true };
  } catch (err) {
    const pesan = err instanceof Error ? err.message : "Gagal mengubah jurnal";
    if (pesan === "TIDAK_ADA") return { ok: false, status: 404, error: "Jurnal tidak ditemukan" };
    if (
      pesan.startsWith("Kode ") ||
      pesan.startsWith("Ada ") ||
      pesan.startsWith("Jurnal pembalik")
    ) {
      return { ok: false, status: 400, error: pesan };
    }
    throw err;
  }
}

export async function hapusJurnal(
  id: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const ada = await prisma.jurnalPenyesuaian.findUnique({
    where: { id },
    select: { id: true, pembalikDariId: true, nomor: true, brandId: true, keterangan: true },
  });
  if (!ada) return { ok: false, status: 404, error: "Jurnal tidak ditemukan" };

  await prisma.$transaction(async (tx) => {
    if (ada.pembalikDariId) {
      await tx.jurnalPenyesuaian.update({
        where: { id: ada.pembalikDariId },
        data: { dibalik: false },
      });
    }
    await tx.jurnalPenyesuaian.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId,
        entitas: "JurnalPenyesuaian",
        entitasId: id,
        aksi: AksiAudit.HAPUS,
        dataLama: { nomor: ada.nomor, brandId: ada.brandId, keterangan: ada.keterangan },
      },
    });
  });
  return { ok: true };
}

function rupiah(n: number) {
  return Math.round(n * 100) / 100;
}

/** Saran nominal. Mutasi = mutasi bank saja. Posisi = saldo kumulatif termasuk jurnal sebelumnya. */
export async function saranAkun(input: { brandId: string; kodeAkunId: string; dari: string; sampai: string }) {
  const kode = await prisma.kodeAkun.findUnique({
    where: { id: input.kodeAkunId },
    select: { id: true, kelompok: true },
  });
  if (!kode) return null;

  const rekening = await prisma.rekening.findMany({
    where: { brandId: input.brandId },
    select: { id: true },
  });
  const rekeningIds = rekening.map((r) => r.id);
  const sampai = new Date(`${input.sampai}T00:00:00.000Z`);

  const [transaksi, jurnal] = await Promise.all([
    rekeningIds.length === 0
      ? Promise.resolve([])
      : prisma.transaksi.findMany({
          where: {
            rekeningId: { in: rekeningIds },
            tanggal: { lte: sampai },
            OR: [{ kodeAkunId: input.kodeAkunId }, { rincian: { some: { kodeAkunId: input.kodeAkunId } } }],
          },
          select: {
            tanggal: true,
            kodeAkunId: true,
            uangMasuk: true,
            uangKeluar: true,
            rincian: { select: { kodeAkunId: true, nominal: true } },
          },
        }),
    prisma.jurnalPenyesuaianBaris.findMany({
      where: {
        kodeAkunId: input.kodeAkunId,
        jurnal: { brandId: input.brandId, tanggal: { lte: sampai } },
      },
      select: { debit: true, kredit: true },
    }),
  ]);

  let periodeMasuk = 0;
  let periodeKeluar = 0;
  let posisi = 0;
  for (const t of transaksi) {
    const iso = t.tanggal.toISOString().slice(0, 10);
    const dalam = iso >= input.dari && iso <= input.sampai;
    if (t.rincian.length > 0) {
      const masuk = t.uangMasuk.gt(0);
      for (const r of t.rincian) {
        if (r.kodeAkunId !== input.kodeAkunId) continue;
        const n = Number(r.nominal);
        if (masuk) {
          posisi -= n;
          if (dalam) periodeMasuk += n;
        } else {
          posisi += n;
          if (dalam) periodeKeluar += n;
        }
      }
    } else if (t.kodeAkunId === input.kodeAkunId) {
      const masuk = Number(t.uangMasuk);
      const keluar = Number(t.uangKeluar);
      posisi += keluar - masuk;
      if (dalam) {
        periodeMasuk += masuk;
        periodeKeluar += keluar;
      }
    }
  }
  for (const b of jurnal) {
    posisi += Number(b.debit) - Number(b.kredit);
  }

  return {
    mutasiMasuk: rupiah(periodeMasuk),
    mutasiKeluar: rupiah(periodeKeluar),
    posisi: rupiah(posisi),
    sisiNormal: sisiNormal(kode.kelompok),
  };
}
