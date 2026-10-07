/** @type {import('next').NextConfig} */
const nextConfig = {
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
