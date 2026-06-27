// 種目アイコン（絵文字）。外部 import を持たない純粋モジュールで、サーバ/クライアント両方から
// 安全に使える（クライアント部品 sport-brand-emoji がヘッダで参照するため切り出した）。
// トップの種目一覧・種目詳細・ヘッダで同じアイコンを出すための単一ソース（UIスラッグ → 絵文字）。
export const CATEGORY_ICONS: Record<string, string> = {
  running: "🏃",
  golf: "⛳",
  outdoor: "🏕️",
  "ball-sports": "⚽",
  fitness: "🧘",
  "water-sports": "🏊",
  "winter-sports": "🎿",
  cycling: "🚴",
  "martial-arts": "🥋",
  leisure: "🎳",
  all: "🔎",
};

/** UIスラッグ（running/golf/outdoor 等）から種目アイコンを返す。未定義なら undefined。 */
export const categoryIcon = (code?: string | null): string | undefined =>
  code ? CATEGORY_ICONS[code] : undefined;
