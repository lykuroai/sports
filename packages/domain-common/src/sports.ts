import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA } from "@spotomo/auth-client";

type Client = SupabaseClient;

export interface SportOption {
  id: string;
  name: string;
  slug: string;
  category_type: string;
  /** 大分類(親)の id。null なら自身が大分類。0032 で階層化。 */
  parent_id: string | null;
}

/** 公開中の種目を表示順で取得（種目選択ピッカー・募集の大分類/小分類用）。 */
export async function fetchPublishedSports(supabase: Client): Promise<SportOption[]> {
  const { data } = await supabase
    .schema(SCHEMA.core)
    .from("sports")
    .select("id, name, slug, category_type, parent_id")
    .eq("status", "published")
    .order("display_order", { ascending: true });
  return (data ?? []) as SportOption[];
}

export interface UserSportRow {
  sport_id: string;
  skill_level: string;
}

/** 当該ユーザの選択種目とレベルを取得。 */
export async function fetchUserSports(
  supabase: Client,
  userId: string,
): Promise<UserSportRow[]> {
  const { data } = await supabase
    .schema(SCHEMA.core)
    .from("user_sports")
    .select("sport_id, skill_level")
    .eq("user_id", userId);
  return (data ?? []) as UserSportRow[];
}

/**
 * 種目選択を全置換で保存（本人のみ。RLS で user_id = auth.uid() が保証される）。
 * selections に無い既存行は削除し、ある行は upsert する。
 */
export async function syncUserSports(
  supabase: Client,
  userId: string,
  selections: { sportId: string; skillLevel: string }[],
): Promise<{ error: string | null }> {
  const keep = selections.map((s) => s.sportId);

  // 選択から外れた種目を削除。
  let del = supabase.schema(SCHEMA.core).from("user_sports").delete().eq("user_id", userId);
  if (keep.length > 0) del = del.not("sport_id", "in", `(${keep.join(",")})`);
  const { error: delErr } = await del;
  if (delErr) return { error: delErr.message };

  if (selections.length === 0) return { error: null };

  const rows = selections.map((s) => ({
    user_id: userId,
    sport_id: s.sportId,
    skill_level: s.skillLevel,
  }));
  const { error } = await supabase
    .schema(SCHEMA.core)
    .from("user_sports")
    .upsert(rows, { onConflict: "user_id,sport_id" });
  return { error: error?.message ?? null };
}
