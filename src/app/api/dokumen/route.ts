import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehRekap } from "@/lib/auth";
import { bolehRekening } from "@/lib/akses";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  MAKS_FILE,
  MAKS_TOTAL,
  MAKS_UKURAN,
  buatIdDokumen,
  bersihkanKedaluwarsa,
  hapusFileDisk,
  kenaliJenis,
  simpanFile,
} from "@/lib/dokumen";

/** Daftar dokumen. Sekalian membersihkan file kedaluwarsa, sebagai pengaman kalau timer terlewat. */
export async function GET(req: Request) {
  const auth = await wajibLogin(bolehRekap);
  if (!auth.ok) return auth.response;

  try {
    await bersihkanKedaluwarsa();

    const sp = new URL(req.url).searchParams;
    const halaman = Math.max(1, Number(sp.get("halaman")) || 1);
    const perHalaman = Math.min(100, Math.max(10, Number(sp.get("perHalaman")) || 30));

    const where: Prisma.DokumenMutasiWhereInput = {};
    const rekeningId = sp.get("rekeningId");
    const batas = auth.user.rekeningIds;
    if (batas) {
      // Dibatasi brand: hanya rekening miliknya; rekening di luar itu dianggap tidak ada isinya
      where.rekeningId = rekeningId ? (batas.includes(rekeningId) ? rekeningId : "-") : { in: batas };
    } else if (rekeningId) where.rekeningId = rekeningId;
    const periode = sp.get("periode");
    if (periode && /^\d{4}-\d{2}$/.test(periode)) where.periode = periode;
    const status = sp.get("status");
    if (status === "ada") where.fileDihapusPada = null;
    if (status === "dihapus") where.fileDihapusPada = { not: null };

    const [dokumen, total] = await Promise.all([
      prisma.dokumenMutasi.findMany({
        where,
        orderBy: { diunggahPada: "desc" },
        skip: (halaman - 1) * perHalaman,
        take: perHalaman,
        include: {
          rekening: { select: { nama: true } },
          diunggahOleh: { select: { nama: true } },
        },
      }),
      prisma.dokumenMutasi.count({ where }),
    ]);

    return NextResponse.json({ dokumen, total, halaman, perHalaman });
  } catch (err) {
    return apiError(err);
  }
}

/** Unggah satu atau banyak dokumen ke satu rekening. */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehRekap);
  if (!auth.ok) return auth.response;

  const tertulis: { id: string; ext: string }[] = [];
  try {
    // Tolak lebih awal dengan pesan jelas, sebelum seluruh body dibaca ke memori.
    const panjang = Number(req.headers.get("content-length"));
    if (Number.isFinite(panjang) && panjang > MAKS_TOTAL) {
      return NextResponse.json(
        { error: `Total ukuran unggahan lebih dari ${MAKS_TOTAL / 1024 / 1024}MB. Bagi jadi beberapa kali unggah.` },
        { status: 413 }
      );
    }

    const form = await req.formData();
    const rekeningId = String(form.get("rekeningId") ?? "");
    const periodeMasuk = String(form.get("periode") ?? "").trim();
    const catatan = String(form.get("catatan") ?? "").trim() || null;
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (!rekeningId) return NextResponse.json({ error: "Rekening wajib dipilih" }, { status: 400 });
    if (periodeMasuk && !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodeMasuk)) {
      return NextResponse.json({ error: "Periode harus berformat YYYY-MM" }, { status: 400 });
    }
    if (files.length === 0) return NextResponse.json({ error: "Tidak ada file yang diunggah" }, { status: 400 });
    if (files.length > MAKS_FILE) {
      return NextResponse.json({ error: `Maksimal ${MAKS_FILE} file sekali unggah` }, { status: 400 });
    }

    const rekening = await prisma.rekening.findUnique({ where: { id: rekeningId } });
    if (!rekening || !rekening.aktif) {
      return NextResponse.json({ error: "Rekening tidak ditemukan atau nonaktif" }, { status: 404 });
    }
    if (!bolehRekening(auth.user, rekeningId)) {
      return NextResponse.json({ error: "Rekening ini di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }

    // Validasi SEMUA file dulu sebelum menulis satu pun, supaya satu file jelek
    // tidak meninggalkan sebagian file tersimpan.
    const siap: { nama: string; isi: Uint8Array; jenis: { ext: string; mime: string } }[] = [];
    for (const f of files) {
      if (f.size === 0) return NextResponse.json({ error: `File "${f.name}" kosong` }, { status: 400 });
      if (f.size > MAKS_UKURAN) {
        return NextResponse.json({ error: `File "${f.name}" lebih dari 15MB` }, { status: 400 });
      }
      const isi = new Uint8Array(await f.arrayBuffer());
      const jenis = kenaliJenis(isi);
      if (!jenis) {
        return NextResponse.json(
          { error: `File "${f.name}" bukan PDF atau gambar (PNG, JPG, WEBP) yang valid` },
          { status: 400 }
        );
      }
      siap.push({ nama: f.name, isi, jenis });
    }

    const hasil = [];
    for (const s of siap) {
      const id = buatIdDokumen();
      await simpanFile(id, s.jenis.ext, s.isi);
      tertulis.push({ id, ext: s.jenis.ext });
      hasil.push(
        await prisma.dokumenMutasi.create({
          data: {
            id,
            rekeningId,
            // Nama asli dibatasi panjangnya; hanya untuk tampilan, tidak dipakai sebagai jalur file
            namaFile: s.nama.replace(/[\r\n]/g, " ").slice(0, 200) || `dokumen.${s.jenis.ext}`,
            tipe: s.jenis.mime,
            ukuran: s.isi.byteLength,
            periode: periodeMasuk || null,
            catatan,
            diunggahOlehId: auth.user.id,
            // Kosong = arsip permanen. Jangan diisi tanggal kedaluwarsa.
            kedaluwarsaPada: null,
          },
        })
      );
    }

    return NextResponse.json({ diunggah: hasil.length });
  } catch (err) {
    // Gagal di tengah jalan: buang file yang sempat tertulis supaya tidak menjadi yatim di disk.
    for (const t of tertulis) await hapusFileDisk(t.id, t.ext).catch(() => {});
    return apiError(err);
  }
}
