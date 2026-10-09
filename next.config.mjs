import os from "node:os";

// Next menolak skrip dev dari host selain localhost. Tanpa ini, membuka
// http://<ip-laptop>:3000 menampilkan halaman tapi JavaScript tidak jalan,
// jadi form login hanya memuat ulang halaman.
function asalDevLokal() {
  const asal = new Set(["127.0.0.1", "financezv.maulanacorp.biz.id"]);
  for (const daftar of Object.values(os.networkInterfaces())) {
    for (const kartu of daftar ?? []) {
      const v4 = kartu.family === "IPv4" || kartu.family === 4;
      if (v4 && !kartu.internal) asal.add(kartu.address);
    }
  }
  return [...asal];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: asalDevLokal(),
  // Wajib untuk Dockerfile di EasyPanel — tanpa ini image jadi besar sekali
  output: "standalone",
  // Indikator dev jangan menutup label Panduan di pojok kiri sidebar.
  devIndicators: { position: "bottom-right" },
  typescript: { ignoreBuildErrors: false },
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    // Semua request lewat proxy.ts, dan bodynya di-buffer maksimal sebesar ini
    // (bawaan Next: 10 MB). Lebih dari itu bodynya terpotong dan upload gagal
    // dengan "Failed to parse body as FormData". Upload terbesar kita: 10 gambar
    // x 10 MB di Rekap, jadi diberi ruang 120 MB.
    proxyClientMaxBodySize: "120mb",
  },
};

export default nextConfig;
