import type { Config } from "tailwindcss";

/**
 * 全 app 共有の Tailwind ベース設定。
 * 各 app の tailwind.config.ts でこれを spread し、content だけ自 app 向けに差し替える。
 */
export const tailwindBase: Omit<Config, "content"> = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2f7d4f",
          dark: "#1f5a38",
        },
      },
    },
  },
  plugins: [],
};
