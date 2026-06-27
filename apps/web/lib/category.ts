import { SCHEMA } from "@spotomo/auth-client";
import type { SupabaseClient } from "@supabase/supabase-js";

// トップ画面の UI 分類スラッグ → core.sports の大分類スラッグ(cat-*) の対応。
const ALIAS: Record<string, string> = {
  running: "cat-running",
  golf: "cat-golf",
  outdoor: "cat-outdoor",
  "ball-sports": "cat-ball",
  fitness: "cat-fitness",
  "water-sports": "cat-water",
  "winter-sports": "cat-winter",
  cycling: "cat-cycling",
  leisure: "cat-leisure",
  "martial-arts": "cat-martial",
};

// トップの種目一覧と種目詳細ページのヘッダで共有する種目アイコン（UIスラッグ → 絵文字）。
// 一覧と詳細で同じアイコンを出すための単一ソース。
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

export type SportNode = { id: string; name: string; slug: string; parent_id: string | null };

/** 公開中の種目（大分類/小分類）を全件取得。 */
export async function fetchSportNodes(supabase: SupabaseClient): Promise<SportNode[]> {
  const { data } = await supabase
    .schema(SCHEMA.core)
    .from("sports")
    .select("id, name, slug, parent_id")
    .eq("status", "published")
    .order("display_order", { ascending: true });
  return (data ?? []) as SportNode[];
}

/**
 * 分類スラッグ（cat-* 大分類 / 小分類 / トップのUIスラッグ）から、該当する sport_id 群を解決する。
 * 大分類なら自身＋配下の小分類、小分類なら自身。未指定なら null（絞り込みなし）、不一致なら []。
 */
export function resolveCategorySportIds(nodes: SportNode[], category?: string | null): string[] | null {
  if (!category) return null;
  const target = ALIAS[category] ?? category;
  const node = nodes.find((n) => n.slug === target);
  if (!node) return [];
  if (node.parent_id == null) {
    const children = nodes.filter((n) => n.parent_id === node.id).map((n) => n.id);
    return [node.id, ...children];
  }
  return [node.id];
}

/** 分類スラッグ（UI / cat-大分類 / 小分類）から大分類ノードを返す。種目別ページ用。 */
export function resolveCategoryParent(nodes: SportNode[], code?: string | null): SportNode | null {
  if (!code) return null;
  const target = ALIAS[code] ?? code;
  const node = nodes.find((n) => n.slug === target);
  if (!node) return null;
  return node.parent_id ? (nodes.find((n) => n.id === node.parent_id) ?? node) : node;
}
