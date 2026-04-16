import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Desativar otimização de imagens do Next.js
  // No Cloudflare Workers, usamos Cloudflare Image Resizing ou URLs diretas
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
