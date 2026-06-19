import type { Config } from "tailwindcss";
import { tailwindBase } from "@spotomo/config/tailwind.base";

const config: Config = {
  ...tailwindBase,
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/shared-ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
