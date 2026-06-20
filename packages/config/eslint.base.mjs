// 共有 ESLint flat config（Next 16 / ESLint 9）。
// Next 16 で `next lint` が廃止されたため、各 app は ESLint CLI（`eslint .`）で
// この設定を読み込む。旧 .eslintrc.json（next/core-web-vitals + next/typescript）の
// 後継。eslint-config-next の flat config 配列をそのまま展開する。
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'] },
  ...coreWebVitals,
  ...typescript,
];
