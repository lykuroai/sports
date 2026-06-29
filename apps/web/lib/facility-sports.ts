import { SCHEMA } from "@spotomo/auth-client";
import type { SupabaseClient } from "@supabase/supabase-js";

// =============================================================
// 施設の種目付与ヘルパー（取り込みバッチ共通・判断ルール①）
//
// 仕様: 施設取り込みは「必ず種目（大分類＋小分類）をセット」する。種目検索 /facilities は
// facility_sports!inner で絞るため、種目紐付けが無い施設は永久に検索に出ない（HOMEには
// 出るのに探せない不整合になる）。そのため取り込み時に core.sports の小分類とその親
// （大分類）の2行を必ず付与する。小分類が推定できない場合は「その他」へフォールバックし、
// 少なくとも検索可能な状態を保証する。
// =============================================================

type FacSchema = ReturnType<SupabaseClient["schema"]>;

export type SportTree = {
  bySlug: Map<string, { id: string; parentId: string | null }>;
  // 推定失敗時のフォールバック（その他のスポーツ / 大分類「その他」）。
  fallback: { childId: string | null; parentId: string | null };
};

/** core.sports（大分類/小分類）の全件を slug 索引で読み込む。 */
export async function loadSportTree(admin: SupabaseClient): Promise<SportTree> {
  const { data } = await admin.schema(SCHEMA.core).from("sports").select("id, slug, parent_id");
  const bySlug = new Map<string, { id: string; parentId: string | null }>();
  for (const r of (data ?? []) as { id: string; slug: string; parent_id: string | null }[]) {
    bySlug.set(r.slug, { id: r.id, parentId: r.parent_id });
  }
  const other = bySlug.get("other-sports");
  const catOther = bySlug.get("cat-other");
  return {
    bySlug,
    fallback: { childId: other?.id ?? null, parentId: catOther?.id ?? other?.parentId ?? null },
  };
}

/**
 * 小分類 slug から「小分類＋大分類」の sport_id 群を解決する。
 * - 子（parent_id あり）→ [子, 親]
 * - 渡されたのが大分類自身 → [大分類]
 * - 未知/未指定 → フォールバック（その他のスポーツ＋大分類その他）
 * 重複は除去して返す。
 */
export function resolveSportIds(tree: SportTree, slug: string | null | undefined): string[] {
  const node = slug ? tree.bySlug.get(slug) : undefined;
  let childId: string | null;
  let parentId: string | null;
  if (node) {
    childId = node.id;
    parentId = node.parentId ?? node.id; // parent_id が無ければ自身が大分類
  } else {
    childId = tree.fallback.childId;
    parentId = tree.fallback.parentId;
  }
  return [...new Set([childId, parentId].filter((v): v is string => !!v))];
}

/**
 * facility へ種目（大分類＋小分類）を必ず付与する。PK(facility_id,sport_id) 重複は無視。
 * 既存施設の取りこぼし（小分類のみで親が無い旧データ）も再取得時にこれで補完される。
 */
export async function ensureFacilitySports(
  fac: FacSchema,
  facilityId: string,
  sportIds: string[],
): Promise<void> {
  if (sportIds.length === 0) return;
  await fac.from("facility_sports").upsert(
    sportIds.map((sport_id) => ({ facility_id: facilityId, sport_id })),
    { onConflict: "facility_id,sport_id", ignoreDuplicates: true },
  );
}
