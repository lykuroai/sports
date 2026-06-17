import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage の公開画像を許可（プロジェクトに合わせて調整）
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
