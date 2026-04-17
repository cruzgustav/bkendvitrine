import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OpenNext requires "standalone" output — it sets this automatically,
  // but declaring it explicitly avoids ambiguity during build.
  output: "standalone",

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Desativar otimização de imagens do Next.js
  // No Cloudflare Workers/Pages, usamos Cloudflare Image Resizing ou URLs diretas
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
