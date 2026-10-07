/**
 * Dijalankan sekali saat server Next.js menyala. Menjadwalkan penghapusan file
 * dokumen mutasi yang sudah lewat masa simpan, supaya tidak bergantung pada ada
 * tidaknya orang yang membuka halaman Dokumen.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Hot reload di mode dev memanggil register() berkali-kali; cukup satu timer.
  const g = globalThis as unknown as { __dokumenTimer?: NodeJS.Timeout };
  if (g.__dokumenTimer) return;

  const { bersihkanKedaluwarsa } = await import("@/lib/dokumen");
  const jalan = () =>
    bersihkanKedaluwarsa().catch((err) => console.error("[dokumen] pembersihan gagal", err));

  setTimeout(jalan, 30_000); // sekali tak lama setelah server menyala
  g.__dokumenTimer = setInterval(jalan, 60 * 60 * 1000); // lalu tiap jam
  g.__dokumenTimer.unref?.();
}
