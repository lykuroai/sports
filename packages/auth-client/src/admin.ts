import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * サービスロールの Supabase クライアント（RLS をバイパス）。**サーバー専用**。
 * 通知作成・監査ログ・管理操作でのみ使用し、呼び出し前に必ず権限検証すること。
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  return createClient(SUPABASE_URL(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
