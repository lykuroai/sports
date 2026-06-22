import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA } from "@spotomo/auth-client";

type Client = SupabaseClient;

/**
 * 利用者がプレミアム会員（有効サブスク）かどうか。account.user_subscriptions を
 * 本人セッションで参照（RLS で本人行のみ可）。active / trialing を有効とみなす。
 * DB 側は core.is_premium() と enforce_event_premium トリガーで最終的に強制するため、
 * これは UI のゲーティング・サーバーアクションの事前判定用。
 */
export async function isPremium(supabase: Client, userId: string): Promise<boolean> {
  const { data } = await supabase
    .schema(SCHEMA.account)
    .from("user_subscriptions")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  const status = (data as { status?: string } | null)?.status;
  return status === "active" || status === "trialing";
}
