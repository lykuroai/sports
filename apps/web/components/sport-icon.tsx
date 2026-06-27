import type { ReactNode, SVGProps } from "react";

// 種目アイコン（端末の絵文字フォントに依存しない自前 SVG。`currentColor` で色を継承）。
// トップの種目一覧と種目詳細ヘッダで共有する単一ソース。slug 未対応時は虫眼鏡(all)へフォールバック。
const PATHS: Record<string, ReactNode> = {
  // ランニング（走る人）
  running: (
    <>
      <circle cx="16" cy="5" r="1.8" />
      <path d="M5 19l3-2.5 1.3-3.5 3 2 1 4.5" />
      <path d="M8.5 13L7 11l3.3-3 2.8 1.8 2.4-.7" />
    </>
  ),
  // ゴルフ（旗とグリーン）
  golf: (
    <>
      <path d="M9 3v13" />
      <path d="M9 3l7 2.2-7 2.2" />
      <ellipse cx="12" cy="19.5" rx="7" ry="2" />
    </>
  ),
  // アウトドア（テント）
  outdoor: (
    <>
      <path d="M3 20h18" />
      <path d="M12 5L4 20" />
      <path d="M12 5l8 15" />
      <path d="M12 11l-4 9" />
      <path d="M12 11l4 9" />
    </>
  ),
  // 球技（ボール）
  "ball-sports": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2l3.3 2.4-1.25 3.9h-4.1L8.7 9.6z" />
      <path d="M12 7.2V3.2M15.3 9.6l3.4-1.6M13.75 13.5l2.2 3M10.25 13.5l-2.2 3M8.7 9.6L5.3 8" />
    </>
  ),
  // フィットネス（ダンベル）
  fitness: (
    <>
      <path d="M3 9.5v5M6 7.5v9M18 7.5v9M21 9.5v5M6 12h12" />
    </>
  ),
  // 水泳・水辺（波）
  "water-sports": (
    <>
      <path d="M2 7c1.6 0 1.6 1.6 3.2 1.6S6.8 7 8.4 7s1.6 1.6 3.2 1.6S13.2 7 14.8 7s1.6 1.6 3.2 1.6S19.6 7 22 7" />
      <path d="M2 12c1.6 0 1.6 1.6 3.2 1.6S6.8 12 8.4 12s1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6S19.6 12 22 12" />
      <path d="M2 17c1.6 0 1.6 1.6 3.2 1.6S6.8 17 8.4 17s1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6S19.6 17 22 17" />
    </>
  ),
  // ウィンター（雪の結晶）
  "winter-sports": (
    <>
      <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" />
      <path d="M12 5.2L9.7 2.9M12 5.2l2.3-2.3M12 18.8l-2.3 2.3M12 18.8l2.3 2.3" />
      <path d="M5.2 12L2.9 9.7M5.2 12l-2.3 2.3M18.8 12l2.3-2.3M18.8 12l2.3 2.3" />
    </>
  ),
  // サイクリング（自転車）
  cycling: (
    <>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M5.5 17.5l4-7h6l-3.5 7M9.5 10.5l3 7M15.5 10.5h-2.5l-1.5 2" />
    </>
  ),
  // 武道（帯）
  "martial-arts": (
    <>
      <path d="M3 10h18v3.5H3z" />
      <path d="M9 13.5l-2 6.5M15 13.5l2 6.5M9 13.5l3 2.5 3-2.5" />
    </>
  ),
  // レジャー（ボウリングボール）
  leisure: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="10" cy="9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="13.2" cy="9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="11.4" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  // すべて（虫眼鏡）
  all: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
};

/** 種目アイコンを表示できる slug か。 */
export function hasSportIcon(code?: string | null): boolean {
  return !!code && code in PATHS;
}

/** 種目アイコン（自前 SVG）。`code` は UI スラッグ（running/golf/outdoor 等）。 */
export function SportIcon({
  code,
  className,
  ...props
}: { code: string; className?: string } & Omit<SVGProps<SVGSVGElement>, "ref">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {PATHS[code] ?? PATHS.all}
    </svg>
  );
}
