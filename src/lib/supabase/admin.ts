import { createClient } from "@supabase/supabase-js";

/**
 * サービスロールの Supabase クライアント（RLS をバイパス）。
 * **サーバー専用**。Server Actions の管理処理でのみ使用し、
 * 呼び出し前に必ず requireAdmin() で管理者であることを検証すること。
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
