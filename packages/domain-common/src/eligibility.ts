import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA } from "@spotomo/auth-client";

type Client = SupabaseClient;

/**
 * 募集作成・参加申請の前提条件（連絡先の認証状況）。
 * メール認証済み かつ 携帯番号認証済み のときのみ活動可能（eligible）。
 * 本人確認（identity）と通知設定はゲートに含めない（機能としては提供する）。
 */
export interface ActivityEligibility {
  emailVerified: boolean;
  phoneVerified: boolean;
  eligible: boolean;
}

/** 当該ユーザーの活動可否を account.users の認証タイムスタンプから判定する。 */
export async function fetchActivityEligibility(
  supabase: Client,
  userId: string,
): Promise<ActivityEligibility> {
  const { data } = await supabase
    .schema(SCHEMA.account)
    .from("users")
    .select("email_verified_at, phone_verified_at")
    .eq("id", userId)
    .maybeSingle();
  const row = (data ?? {}) as { email_verified_at?: string | null; phone_verified_at?: string | null };
  const emailVerified = !!row.email_verified_at;
  const phoneVerified = !!row.phone_verified_at;
  return { emailVerified, phoneVerified, eligible: emailVerified && phoneVerified };
}
