"use client";

import * as React from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  INPUT_CLASS,
  Modal,
  Skeleton,
} from "@/components/ui/primitives";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { cn, formatAngka, formatTanggal } from "@/lib/utils";

interface BarisTampil {
  kodeAkunId: string;
  kode: string;
  nama: string;
  debit: number;
  kredit: number;
}

interface JurnalTampil {
  id: string;
  nomor: number;
  tanggal: string;
  keterangan: string;
  dibalik: boolean;
  pembalik: { id: string; nomor: number; tanggal: string } | null;
  asal: { id: string; nomor: number; tanggal: string } | null;
  brand: { id: string; nama: string };
  dibuatOleh: string | null;
  baris: BarisTampil[];
}

interface Saran {
  mutasiMasuk: number;
  mutasiKeluar: number;
  posisi: number;
  sisiNormal: "debit" | "kredit";
}

interface BarisForm {
  kunci: string;
  kodeAkunId: string | null;
  debit: string;
  kredit: string;
}

function barisKosong(): BarisForm {
  return { kunci: crypto.randomUUID(), kodeAkunId: null, debit: "", kredit: "" };
}

function angka(teks: string): number {
  const t = teks.trim().replace(/\s/g, "");
  if (!t) return 0;
  const n =
    t.includes(",") && t.includes(".")
      ? Number(t.replace(/\./g, "").replace(",", "."))
      : t.includes(",")
        ? Number(t.replace(",", "."))
        : Number(t);
  return Number.isFinite(n) ? n : 0;
}

function tulis(n: number): string {
  if (!n) return "";
  const [utuh, pecahan] = (Math.round(n * 100) / 100).toFixed(2).split(".");
  return pecahan === "00" ? utuh : `${utuh},${pecahan}`;
}

function total(baris: { debit: number; kredit: number }[]) {
  const debit = Math.round(baris.reduce((s, b) => s + b.debit * 100, 0)) / 100;
  const kredit = Math.round(baris.reduce((s, b) => s + b.kredit * 100, 0)) / 100;
  return { debit, kredit };
}

export function JurnalPenyesuaianPanel({
  dari,
  sampai,
  brandId,
  namaBrand,
  rekeningTanpaBrand,
}: {
  dari: string;
  sampai: string;
  brandId: string | null;
  namaBrand: string | null;
  rekeningTanpaBrand: boolean;
}) {
  const [jurnal, setJurnal] = React.useState<JurnalTampil[]>([]);
  const [bolehUbah, setBolehUbah] = React.useState(false);
  const [memuat, setMemuat] = React.useState(true);
  const [brand, setBrand] = React.useState<{ id: string; nama: string }[]>([]);
  const [kode, setKode] = React.useState<SelectOption[]>([]);
  const [buka, setBuka] = React.useState(false);
  const [menyimpan, setMenyimpan] = React.useState(false);
  const [mengunduh, setMengunduh] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [hapusId, setHapusId] = React.useState<string | null>(null);
  const [formBrand, setFormBrand] = React.useState<string | null>(brandId);
  const [tanggal, setTanggal] = React.useState(sampai);
  const [keterangan, setKeterangan] = React.useState("");
  const [dibalik, setDibalik] = React.useState(false);
  const [baris, setBaris] = React.useState<BarisForm[]>([barisKosong(), barisKosong()]);
  const [saran, setSaran] = React.useState<Record<string, Saran>>({});
  const saranDiminta = React.useRef(new Set<string>());

  const muat = React.useCallback(async () => {
    if (rekeningTanpaBrand || !dari || !sampai) {
      setJurnal([]);
      setMemuat(false);
      return;
    }
    setMemuat(true);
    try {
      const q = new URLSearchParams({ dari, sampai });
      if (brandId) q.set("brandId", brandId);
      const res = await fetch(`/api/jurnal-penyesuaian?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJurnal(data.jurnal);
      setBolehUbah(Boolean(data.bolehUbah));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat jurnal");
    } finally {
      setMemuat(false);
    }
  }, [dari, sampai, brandId, rekeningTanpaBrand]);

  React.useEffect(() => {
    muat();
  }, [muat]);

  React.useEffect(() => {
    (async () => {
      try {
        const [rb, rk] = await Promise.all([fetch("/api/brand"), fetch("/api/kode-akun?aktif=1")]);
        if (rb.ok) {
          const data = await rb.json();
          setBrand((data.brand as { id: string; nama: string }[]).map((b) => ({ id: b.id, nama: b.nama })));
        }
        if (rk.ok) {
          const data = await rk.json();
          setKode(
            (data.kodeAkun as { id: string; kode: string; nama: string; kelompok: string; sistem: boolean }[])
              .filter((k) => !k.sistem)
              .map((k) => ({ value: k.id, label: `${k.kode} — ${k.nama}`, hint: k.kelompok }))
          );
        }
      } catch {
        /* dropdown kosong, form tetap bisa ditutup */
      }
    })();
  }, []);

  function bukaBaru() {
    setEditId(null);
    setFormBrand(brandId);
    setTanggal(sampai);
    setKeterangan("");
    setDibalik(false);
    setBaris([barisKosong(), barisKosong()]);
    setSaran({});
    saranDiminta.current = new Set();
    setBuka(true);
  }

  function bukaUbah(j: JurnalTampil) {
    setEditId(j.id);
    setFormBrand(j.brand.id);
    setTanggal(j.tanggal);
    setKeterangan(j.keterangan);
    setDibalik(j.dibalik);
    setBaris(
      j.baris.map((b) => ({
        kunci: crypto.randomUUID(),
        kodeAkunId: b.kodeAkunId,
        debit: tulis(b.debit),
        kredit: tulis(b.kredit),
      }))
    );
    setSaran({});
    saranDiminta.current = new Set();
    setBuka(true);
  }

  React.useEffect(() => {
    if (!buka || !formBrand) return;
    const ids = [...new Set(baris.map((b) => b.kodeAkunId).filter((id): id is string => Boolean(id)))];
    for (const id of ids) {
      const kunci = `${formBrand}|${id}|${dari}|${sampai}`;
      if (saranDiminta.current.has(kunci)) continue;
      saranDiminta.current.add(kunci);
      const q = new URLSearchParams({ brandId: formBrand, kodeAkunId: id, dari, sampai });
      fetch(`/api/jurnal-penyesuaian/saran?${q}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: Saran | null) => {
          if (data) setSaran((prev) => ({ ...prev, [kunci]: data }));
        })
        .catch(() => undefined);
    }
  }, [buka, formBrand, baris, dari, sampai]);

  function isi(kunci: string, sisi: "debit" | "kredit", nilai: number) {
    setBaris((prev) =>
      prev.map((b) =>
        b.kunci === kunci
          ? {
              ...b,
              debit: sisi === "debit" ? tulis(nilai) : "",
              kredit: sisi === "kredit" ? tulis(nilai) : "",
            }
          : b
      )
    );
  }

  const pratinjau = baris.map((b) => ({ debit: angka(b.debit), kredit: angka(b.kredit) }));
  const jumlah = total(pratinjau);
  const selisih = Math.round((jumlah.debit - jumlah.kredit) * 100) / 100;
  const seimbang = selisih === 0 && jumlah.debit > 0;

  async function simpan() {
    if (!formBrand) {
      toast.error("Pilih brand dulu");
      return;
    }
    setMenyimpan(true);
    try {
      const payload = {
        brandId: formBrand,
        tanggal,
        keterangan,
        dibalik,
        baris: baris
          .filter((b) => b.kodeAkunId && (angka(b.debit) > 0 || angka(b.kredit) > 0))
          .map((b) => ({ kodeAkunId: b.kodeAkunId, debit: angka(b.debit), kredit: angka(b.kredit) })),
      };
      const res = await fetch(editId ? `/api/jurnal-penyesuaian/${editId}` : "/api/jurnal-penyesuaian", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editId ? "Jurnal diubah" : "Jurnal disimpan");
      setBuka(false);
      await muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(id: string) {
    try {
      const res = await fetch(`/api/jurnal-penyesuaian/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Jurnal dihapus");
      setHapusId(null);
      await muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  }

  async function unduh() {
    setMengunduh(true);
    try {
      const q = new URLSearchParams({ dari, sampai });
      if (brandId) q.set("brandId", brandId);
      const res = await fetch(`/api/jurnal-penyesuaian/pdf?${q}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal membuat PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jurnal-penyesuaian_${dari}_${sampai}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh PDF");
    } finally {
      setMengunduh(false);
    }
  }

  const grand = total(jurnal.flatMap((j) => j.baris));

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Jurnal Penyesuaian</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
            {namaBrand ? `Brand ${namaBrand}. ` : "Semua brand. "}
            Jurnal ini tidak menggerakkan saldo bank. Reklasifikasi seperti Deposit Gaji menjadi Beban Gaji
            langsung mengurangi laba dan harta. Centang balik hanya untuk akrual.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button varian="sekunder" onClick={unduh} loading={mengunduh} disabled={rekeningTanpaBrand}>
            <Download className="h-4 w-4" />
            Unduh PDF
          </Button>
          {bolehUbah && (
            <Button onClick={bukaBaru} disabled={rekeningTanpaBrand}>
              <Plus className="h-4 w-4" />
              Jurnal baru
            </Button>
          )}
        </div>
      </div>

      {rekeningTanpaBrand && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Rekening yang dipilih belum punya brand. Jurnal penyesuaian dicatat per brand — pilih brand di filter,
          atau kosongkan rekening.
        </p>
      )}

      {memuat ? (
        <Skeleton baris={6} />
      ) : jurnal.length === 0 ? (
        <EmptyState pesan="Belum ada jurnal penyesuaian pada periode ini." />
      ) : (
        <div className="space-y-4">
          {jurnal.map((j) => {
            const t = total(j.baris);
            return (
              <section key={j.id} className="overflow-hidden rounded-lg border border-gray-200 dark:border-zinc-700">
                <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800/80">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-50">JP-{j.nomor}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{formatTanggal(j.tanggal)}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{j.brand.nama}</span>
                      {j.asal && <Badge warna="biru">Pembalik JP-{j.asal.nomor}</Badge>}
                      {j.dibalik && j.pembalik && (
                        <Badge warna="kuning">Dibalik {formatTanggal(j.pembalik.tanggal)}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">{j.keterangan}</p>
                  </div>
                  {bolehUbah && (
                    <div className="flex shrink-0 gap-2">
                      {!j.asal && (
                        <Button varian="sekunder" onClick={() => bukaUbah(j)}>
                          Ubah
                        </Button>
                      )}
                      {hapusId === j.id ? (
                        <Button varian="bahaya" onClick={() => hapus(j.id)}>
                          Ya, hapus
                        </Button>
                      ) : (
                        <Button varian="sekunder" onClick={() => setHapusId(j.id)}>
                          Hapus
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-600 dark:text-gray-400">
                        <th className="px-3 py-2 font-medium">Akun</th>
                        <th className="px-3 py-2 text-right font-medium">Debit</th>
                        <th className="px-3 py-2 text-right font-medium">Kredit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {j.baris.map((b, i) => (
                        <tr key={`${j.id}-${i}`} className="border-t border-gray-100 dark:border-zinc-800">
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                            <span className="font-medium tabular-nums">{b.kode}</span>
                            <span className="text-gray-700 dark:text-gray-300"> {b.nama}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                            {b.debit ? formatAngka(b.debit) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                            {b.kredit ? formatAngka(b.kredit) : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-200 font-semibold dark:border-zinc-700">
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-50">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatAngka(t.debit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatAngka(t.kredit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
          <div className="flex justify-end gap-6 px-3 text-sm font-semibold text-gray-900 dark:text-gray-50">
            <span>Grand total</span>
            <span className="tabular-nums">{formatAngka(grand.debit)}</span>
            <span className="tabular-nums">{formatAngka(grand.kredit)}</span>
          </div>
        </div>
      )}

      <Modal
        buka={buka}
        lebar="xl"
        judul={editId ? "Ubah jurnal penyesuaian" : "Jurnal penyesuaian baru"}
        deskripsi="Debit harus sama dengan kredit. Saldo rekening tidak berubah."
        onTutup={() => setBuka(false)}
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <SearchableSelect
              label="Brand"
              value={formBrand}
              onChange={setFormBrand}
              options={brand.map((b) => ({ value: b.id, label: b.nama }))}
              placeholder="Pilih brand"
              disabled={Boolean(brandId)}
            />
            <Field label="Tanggal" required>
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={INPUT_CLASS} />
            </Field>
          </div>
          <Field label="Keterangan" required hint="Misalnya: reklasifikasi deposit gaji September">
            <input
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              className={INPUT_CLASS}
              maxLength={300}
            />
          </Field>
          <label className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input
              type="checkbox"
              className="mt-1"
              checked={dibalik}
              onChange={(e) => setDibalik(e.target.checked)}
            />
            <span>
              Balik tanggal 1 bulan berikutnya.
              <span className="mt-0.5 block text-gray-600 dark:text-gray-400">
                Jangan dicentang untuk reklasifikasi (Deposit jadi Beban) — itu tetap. Centang hanya untuk akrual,
                misalnya beban yang belum dibayar. Menurut kebiasaan SAK, akrual dibalik di awal periode berikut
                supaya saat uangnya benar-benar bergerak tidak terhitung dua kali.
              </span>
            </span>
          </label>

          <div className="space-y-3">
            {baris.map((b, index) => {
              const kunciSaran = formBrand && b.kodeAkunId ? saran[`${formBrand}|${b.kodeAkunId}|${dari}|${sampai}`] : undefined;
              return (
                <div key={b.kunci} className="rounded-lg border border-gray-200 p-3 dark:border-zinc-700">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Baris {index + 1}</span>
                    {baris.length > 2 && (
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-1 text-sm text-red-700 dark:text-red-400"
                        onClick={() => setBaris((prev) => prev.filter((x) => x.kunci !== b.kunci))}
                      >
                        <Trash2 className="h-4 w-4" />
                        Hapus baris
                      </button>
                    )}
                  </div>
                  <SearchableSelect
                    label="Kode akun"
                    value={b.kodeAkunId}
                    onChange={(v) =>
                      setBaris((prev) => prev.map((x) => (x.kunci === b.kunci ? { ...x, kodeAkunId: v } : x)))
                    }
                    options={kode}
                    placeholder="Pilih kode"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Debit">
                      <input
                        inputMode="decimal"
                        value={b.debit}
                        onChange={(e) =>
                          setBaris((prev) =>
                            prev.map((x) => (x.kunci === b.kunci ? { ...x, debit: e.target.value, kredit: e.target.value ? "" : x.kredit } : x))
                          )
                        }
                        className={INPUT_CLASS}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Kredit">
                      <input
                        inputMode="decimal"
                        value={b.kredit}
                        onChange={(e) =>
                          setBaris((prev) =>
                            prev.map((x) => (x.kunci === b.kunci ? { ...x, kredit: e.target.value, debit: e.target.value ? "" : x.debit } : x))
                          )
                        }
                        className={INPUT_CLASS}
                        placeholder="0"
                      />
                    </Field>
                  </div>
                  {kunciSaran && (
                    <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <SaranBaris
                        label="Mutasi keluar periode ini"
                        nilai={kunciSaran.mutasiKeluar}
                        onDebit={() => isi(b.kunci, "debit", kunciSaran.mutasiKeluar)}
                        onKredit={() => isi(b.kunci, "kredit", kunciSaran.mutasiKeluar)}
                      />
                      <SaranBaris
                        label="Mutasi masuk periode ini"
                        nilai={kunciSaran.mutasiMasuk}
                        onDebit={() => isi(b.kunci, "debit", kunciSaran.mutasiMasuk)}
                        onKredit={() => isi(b.kunci, "kredit", kunciSaran.mutasiMasuk)}
                      />
                      <SaranBaris
                        label={kunciSaran.posisi >= 0 ? "Posisi kumulatif (debit)" : "Posisi kumulatif (kredit)"}
                        nilai={Math.abs(kunciSaran.posisi)}
                        onDebit={() => isi(b.kunci, "debit", Math.abs(kunciSaran.posisi))}
                        onKredit={() => isi(b.kunci, "kredit", Math.abs(kunciSaran.posisi))}
                      />
                      <p>
                        Untuk memindahkan deposit ke beban: di akun deposit klik kredit, di akun beban klik debit.
                        Angka saran boleh diubah.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            varian="sekunder"
            onClick={() => setBaris((prev) => [...prev, barisKosong()])}
          >
            <Plus className="h-4 w-4" />
            Tambah baris
          </Button>

          <p className={cn("text-sm font-medium", seimbang ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300")}>
            {seimbang
              ? `Seimbang, ${formatAngka(jumlah.debit)}`
              : `Selisih ${formatAngka(Math.abs(selisih))} — debit ${formatAngka(jumlah.debit)}, kredit ${formatAngka(jumlah.kredit)}`}
          </p>

          <div className="flex justify-end gap-2">
            <Button varian="sekunder" onClick={() => setBuka(false)}>
              Batal
            </Button>
            <Button onClick={simpan} loading={menyimpan} disabled={!seimbang}>
              Simpan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SaranBaris({
  label,
  nilai,
  onDebit,
  onKredit,
}: {
  label: string;
  nilai: number;
  onDebit: () => void;
  onKredit: () => void;
}) {
  if (!nilai) return null;
  return (
    <p className="flex flex-wrap items-center gap-1">
      <span>
        {label}: {formatAngka(nilai)}
      </span>
      <button type="button" className="inline-flex min-h-11 items-center rounded border border-gray-300 px-2 text-gray-800 dark:border-zinc-600 dark:text-gray-200" onClick={onDebit}>
        isi debit
      </button>
      <button type="button" className="inline-flex min-h-11 items-center rounded border border-gray-300 px-2 text-gray-800 dark:border-zinc-600 dark:text-gray-200" onClick={onKredit}>
        isi kredit
      </button>
    </p>
  );
}
