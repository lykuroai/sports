import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** 現在のユーザーが管理者なら User を返す。そうでなければ null。 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  return data ? user : null;
}

/** 管理者でなければトップへリダイレクト。管理者なら User を返す。 */
export async function requireAdmin(): Promise<User> {
  const user = await getAdminUser();
  if (!user) redirect("/");
  return user;
}

/** 監査ログを記録（仕様 §11.1） */
export async function writeAuditLog(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail?: Record<string, unknown>,
) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    detail: detail ?? null,
  });
}
