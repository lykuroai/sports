import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@spotomo/shared-types",
    "@spotomo/shared-ui",
    "@spotomo/auth-client",
    "@spotomo/domain-common",
    "@spotomo/api-client",
  ],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
