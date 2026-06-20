import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA } from "@spotomo/auth-client";

type Client = SupabaseClient;

/** 他利用者に公開してよいプロフィール項目のみ（本名・email・phone は含めない）。 */
export interface PublicProfile {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  introduction: string | null;
  gender: string;
  age_range: string | null;
  area: string | null;
  verification_status: string | null;
  rating: number;
  participation_count: number;
  organizer_count: number;
}

const PUBLIC_COLUMNS =
  "user_id, nickname, avatar_url, introduction, gender, age_range, area, verification_status, rating, participation_count, organizer_count";

/** 公開プロフィールを1件取得。account.profiles は RLS で全公開読み取り可。 */
export async function fetchPublicProfile(
  supabase: Client,
  userId: string,
): Promise<PublicProfile | null> {
  const { data } = await supabase
    .schema(SCHEMA.account)
    .from("profiles")
    .select(PUBLIC_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as PublicProfile | null) ?? null;
}

/** a・b のどちらかが相手をブロックしていれば true（双方向判定）。 */
export async function isBlockedBetween(
  supabase: Client,
  a: string,
  b: string,
): Promise<boolean> {
  if (a === b) return false;
  const { data } = await supabase
    .schema(SCHEMA.core)
    .from("blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`,
    )
    .limit(1);
  return (data?.length ?? 0) > 0;
}
