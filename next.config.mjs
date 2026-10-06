/** @type {import('next').NextConfig} */
const nextConfig = {
  // Wajib untuk Dockerfile di EasyPanel — tanpa ini image jadi besar sekali
  output: "standalone",
  typescript: { ignoreBuildErrors: false },
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
