/** 全 app 共有の PostCSS 設定。各 app の postcss.config.mjs から re-export する。 */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
