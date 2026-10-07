import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

/** Id acak 96-bit, huruf kecil dan angka saja — aman dipakai sebagai nama file. */
export function buatIdDokumen(): string {
  return randomBytes(12).toString("hex");
}

export const MAKS_UKURAN = 15 * 1024 * 1024; // 15MB per file
export const MAKS_FILE = 10;
/** Batas total satu kali unggah; harus di bawah experimental.proxyClientMaxBodySize di next.config.mjs. */
export const MAKS_TOTAL = 100 * 1024 * 1024;

/**
 * Folder penyimpanan arsip. Di server wajib diarahkan ke volume persisten
 * (DOKUMEN_DIR), kalau tidak file hilang tiap container dibuat ulang.
 */
export function folderDokumen(): string {
  return path.resolve(process.env.DOKUMEN_DIR || path.join(process.cwd(), "storage", "dokumen"));
}

export type JenisFile = { ext: string; mime: string };

/**
 * Kenali jenis file dari ISI-nya, bukan dari nama atau Content-Type yang dikirim
 * pengunggah — keduanya bisa dipalsukan. Selain PDF dan gambar ditolak.
 */
export function kenaliJenis(b: Uint8Array): JenisFile | null {
  const mulai = (...byte: number[]) => byte.every((v, i) => b[i] === v);
  if (mulai(0x25, 0x50, 0x44, 0x46, 0x2d)) return { ext: "pdf", mime: "application/pdf" };
  if (mulai(0x89, 0x50, 0x4e, 0x47)) return { ext: "png", mime: "image/png" };
  if (mulai(0xff, 0xd8, 0xff)) return { ext: "jpg", mime: "image/jpeg" };
  if (mulai(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

/**
 * Jalur file di disk dibentuk HANYA dari id yang dibuat server dan ekstensi dari
 * daftar tetap — tidak pernah dari input pengguna, jadi tidak ada path traversal.
 */
export function jalurFile(id: string, ext: string): string {
  if (!/^[a-z0-9]+$/i.test(id) || !/^[a-z]{3,4}$/.test(ext)) {
    throw new Error("Identitas file tidak valid");
  }
  return path.join(folderDokumen(), `${id}.${ext}`);
}

export async function simpanFile(id: string, ext: string, isi: Uint8Array) {
  await mkdir(folderDokumen(), { recursive: true });
  await writeFile(jalurFile(id, ext), isi);
}

export async function bacaFile(id: string, ext: string) {
  return readFile(jalurFile(id, ext));
}

export async function hapusFileDisk(id: string, ext: string) {
  // force: file yang sudah tidak ada bukan kesalahan
  await rm(jalurFile(id, ext), { force: true });
}

/** Ekstensi dari nama tipe yang tersimpan di catatan. */
export function ekstensiDariTipe(tipe: string): string {
  return { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[tipe] ?? "bin";
}

/**
 * Hapus file sementara yang sudah lewat masa simpan, lalu tandai catatannya.
 * Arsip halaman Dokumen (`kedaluwarsaPada` kosong) tidak pernah disentuh.
 * Catatan tidak pernah dihapus. Aman dipanggil berulang.
 */
export async function bersihkanKedaluwarsa(): Promise<number> {
  const lewat = await prisma.dokumenMutasi.findMany({
    where: { kedaluwarsaPada: { lte: new Date() }, fileDihapusPada: null },
    select: { id: true, tipe: true },
    take: 500,
  });
  let terhapus = 0;
  for (const d of lewat) {
    try {
      await hapusFileDisk(d.id, ekstensiDariTipe(d.tipe));
      await prisma.dokumenMutasi.update({ where: { id: d.id }, data: { fileDihapusPada: new Date() } });
      terhapus++;
    } catch (err) {
      // Jangan menandai terhapus kalau filenya gagal dihapus — dicoba lagi di putaran berikutnya.
      console.error("[dokumen] gagal menghapus file kedaluwarsa", d.id, err);
    }
  }
  return terhapus;
}
