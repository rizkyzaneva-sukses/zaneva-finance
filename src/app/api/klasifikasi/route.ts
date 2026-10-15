import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehRekap } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bolehRekening } from "@/lib/akses";
import { muatContohUntukPrompt, muatPetaContoh } from "@/lib/contoh-klasifikasi";
import { sarankanKodeAkun } from "@/lib/openrouter";
import {
  KODE_PENJUALAN,
  kunciBelajar,
  pengecualianKode400,
  tandaiDuplikat,
  teksAlasanDuplikat,
} from "@/lib/mutasi-pola";
import { alasanKodeHarusKosong, cariKodeRefOtomatis } from "@/lib/kode-ref-otomatis";
import { tanggalKeIso } from "@/lib/utils";

interface BarisMasuk {
  keterangan?: string;
  uangMasuk?: number;
  uangKeluar?: number;
  tanggalIso?: string | null;
}

/** Tahap 2: kode akun (aturan + ingatan koreksi + AI) dan tanda duplikat. */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehRekap);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const baris: BarisMasuk[] = Array.isArray(body.baris) ? body.baris : [];
    const rekeningId = body.rekeningId ? String(body.rekeningId) : "";
    if (baris.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris untuk diklasifikasi" }, { status: 400 });
    }

    if (rekeningId) {
      const rekening = await prisma.rekening.findUnique({
        where: { id: rekeningId },
        select: { id: true },
      });
      if (!rekening) {
        return NextResponse.json({ error: "Rekening tidak ditemukan" }, { status: 404 });
      }
      if (!bolehRekening(auth.user, rekeningId)) {
        return NextResponse.json({ error: "Rekening ini di luar brand yang ditugaskan ke kamu" }, { status: 403 });
      }
    }

    const daftarKode = await prisma.kodeAkun.findMany({
      where: { aktif: true, sistem: false },
      orderBy: { urutan: "asc" },
      select: { id: true, kode: true, nama: true },
    });
    const byKode = new Map(daftarKode.map((k) => [k.kode, k]));
    const kodeTersedia = new Set(daftarKode.map((k) => k.kode));
    const kode400 = byKode.get(KODE_PENJUALAN);
    const contoh = await muatPetaContoh();

    const siap = baris.map((b, index) => ({
      index,
      teks: String(b.keterangan ?? ""),
      arah: Number(b.uangMasuk ?? 0) > 0 ? ("masuk" as const) : ("keluar" as const),
      tanggalIso: b.tanggalIso ? String(b.tanggalIso) : null,
      uangMasuk: Number(b.uangMasuk ?? 0) || 0,
      uangKeluar: Number(b.uangKeluar ?? 0) || 0,
    }));

    const perluAi = siap.filter((row) => {
      const kunci = kunciBelajar(row.teks);
      const otomatis = cariKodeRefOtomatis(row.teks, row.arah, kodeTersedia);
      if (alasanKodeHarusKosong(row.teks, row.arah)) return false;
      if (otomatis?.prioritas) return false;
      if (kunci && contoh.has(`${row.arah}|${kunci}`)) return false;
      if (otomatis) return false;
      if (row.arah === "masuk" && !pengecualianKode400(row.teks) && kode400) return false;
      return true;
    });

    let peringatan: string | null = null;
    let saranAi = new Map<number, string>();
    if (perluAi.length > 0) {
      try {
        saranAi = await sarankanKodeAkun(perluAi, daftarKode, await muatContohUntukPrompt());
      } catch (err) {
        peringatan =
          err instanceof Error
            ? `Saran AI gagal: ${err.message}. Kode 400 tetap terisi, sisanya isi manual.`
            : "Saran AI gagal. Kode 400 tetap terisi, sisanya isi manual.";
      }
    }

    const tanggalUnik = [
      ...new Set(siap.map((b) => b.tanggalIso).filter((t): t is string => Boolean(t))),
    ];
    const tersimpan = rekeningId && tanggalUnik.length > 0
      ? await prisma.transaksi.findMany({
          where: {
            rekeningId,
            tanggal: { in: tanggalUnik.map((t) => new Date(`${t}T00:00:00.000Z`)) },
          },
          select: { tanggal: true, keterangan: true, uangMasuk: true, uangKeluar: true },
        })
      : [];

    const duplikat = tandaiDuplikat(
      siap.map((b) => ({
        tanggalIso: b.tanggalIso,
        keterangan: b.teks,
        uangMasuk: b.uangMasuk,
        uangKeluar: b.uangKeluar,
      })),
      tersimpan.map((t) => ({
        tanggalIso: tanggalKeIso(t.tanggal),
        keterangan: t.keterangan,
        uangMasuk: t.uangMasuk.toNumber(),
        uangKeluar: t.uangKeluar.toNumber(),
      }))
    );

    const hasil = siap.map((row) => {
      const kunci = kunciBelajar(row.teks);
      const ingat = kunci ? contoh.get(`${row.arah}|${kunci}`) : undefined;
      const alasanDuplikat = duplikat[row.index];
      const otomatis = cariKodeRefOtomatis(row.teks, row.arah, kodeTersedia);
      const alasanKosong = alasanKodeHarusKosong(row.teks, row.arah);

      let kodeAkunId: string | null = null;
      let kode: string | null = null;
      let statusKode: "KOSONG" | "SARAN_AI" | "DIKONFIRMASI" = "KOSONG";
      let asal: "aturan" | "belajar" | "ai" | "kosong" = "kosong";
      let alasan: string | null = null;

      if (alasanKosong) {
        alasan = alasanKosong;
      } else if (otomatis?.prioritas) {
        const akunOtomatis = byKode.get(otomatis.kode);
        if (akunOtomatis) {
          kodeAkunId = akunOtomatis.id;
          kode = akunOtomatis.kode;
          statusKode = "SARAN_AI";
          asal = "aturan";
          alasan = otomatis.alasan;
        }
      } else if (ingat) {
        kodeAkunId = ingat.kodeAkunId;
        kode = ingat.kode;
        statusKode = "SARAN_AI";
        asal = ingat.kode === KODE_PENJUALAN && row.arah === "masuk" ? "aturan" : "belajar";
        alasan =
          ingat.kode === KODE_PENJUALAN && row.arah === "masuk"
            ? "penjualan masuk default"
            : "koreksi tim sebelumnya";
      } else {
        const akunOtomatis = otomatis ? byKode.get(otomatis.kode) : undefined;
        if (akunOtomatis) {
          kodeAkunId = akunOtomatis.id;
          kode = akunOtomatis.kode;
          // Aturan tetap hanya mengisi saran. Tim tetap harus meninjau atau
          // mengubahnya di preview sebelum dianggap terkonfirmasi.
          statusKode = "SARAN_AI";
          asal = "aturan";
          alasan = otomatis?.alasan ?? "aturan otomatis";
        }
      }
      if (!alasanKosong && !kodeAkunId && row.arah === "masuk" && !pengecualianKode400(row.teks) && kode400) {
        kodeAkunId = kode400.id;
        kode = kode400.kode;
        statusKode = "SARAN_AI";
        asal = "aturan";
        alasan = "penjualan masuk default";
      } else if (!alasanKosong && !kodeAkunId) {
        const tebakan = saranAi.get(row.index);
        const akun = tebakan ? byKode.get(tebakan) : undefined;
        if (akun) {
          kodeAkunId = akun.id;
          kode = akun.kode;
          statusKode = "SARAN_AI";
          asal = "ai";
          alasan = "saran AI";
        }
      }

      return {
        kodeAkunId,
        kode,
        statusKode,
        asal,
        alasan,
        duplikat: alasanDuplikat,
        alasanDuplikat: alasanDuplikat ? teksAlasanDuplikat(alasanDuplikat) : null,
      };
    });

    return NextResponse.json({ hasil, peringatan });
  } catch (err) {
    return apiError(err);
  }
}
