import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Docker / 自前サーバ向け: 最小構成の standalone サーバを出力（apps/<name>/server.js）
  output: "standalone",
  // モノレポのため、ワークスペース全体を追跡ルートにする
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: [
    "@spotomo/shared-types",
    "@spotomo/shared-ui",
    "@spotomo/auth-client",
    "@spotomo/domain-common",
    "@spotomo/api-client",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      // 楽天GORA のゴルフ場画像（rakuten.co.jp 配下／楽天CDN r10s.jp・rakuten.ne.jp）
      { protocol: "https", hostname: "**.rakuten.co.jp" },
      { protocol: "https", hostname: "**.r10s.jp" },
      { protocol: "https", hostname: "**.rakuten.ne.jp" },
    ],
  },
};

export default nextConfig;
