/**
 * Dijalankan sekali saat server Next.js menyala. Menjadwalkan pembersihan file
 * sementara yang masih punya tanggal kedaluwarsa. Arsip Dokumen (tanggal kosong)
 * tidak pernah dihapus.
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
