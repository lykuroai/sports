import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";
import { createAdminClient } from "./admin";
import { loginUrl } from "./env";

/**
 * 共通ユーザ基盤のスキーマ名。supabase-js は既定で public のみを参照するため、
 * account/core/facility/種目スキーマは `.schema()` で明示する。
 * これらのスキーマは Supabase の「Exposed schemas」に追加し、anon/authenticated に
 * usage を grant しておくこと（migrations の grant 文と一致）。
 */
export const SCHEMA = {
  account: "account",
  core: "core",
  facility: "facility",
} as const;

/** ログイン中のユーザを返す（未ログインなら null）。 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * 種目アプリ（golf/running/outdoor 等）の未ログイン導線用。現在のリクエストの自オリジンを基に、
 * 認証後 `path` へ戻る account 共通ログインの絶対URLを作る。種目アプリには /login が無いため、
 * 相対 "/login" へ飛ばすと 404 になる。必ずこの絶対URL（ACCOUNT_URL 配下）へ誘導すること。
 */
export async function loginUrlFor(path: string): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "";
  return loginUrl(`${proto}://${host}${path}`);
}

/** ログイン必須。未ログインなら account のログインへ。 */
export async function requireUser(redirectTo = "/"): Promise<User> {
  const user = await getUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  return user;
}

/** 管理者なら User を返す。そうでなければ null。 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .schema(SCHEMA.account)
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  return data ? user : null;
}

/** 管理者でなければトップへリダイレクト。 */
export async function requireAdmin(): Promise<User> {
  const user = await getAdminUser();
  if (!user) redirect("/");
  return user;
}

/** 当該施設の verified オーナーなら User を返す。 */
export async function getFacilityOwner(facilityId: string): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .schema(SCHEMA.facility)
    .from("facility_owners")
    .select("status")
    .eq("facility_id", facilityId)
    .eq("user_id", user.id)
    .eq("status", "verified")
    .maybeSingle();

  return data ? user : null;
}

export async function requireFacilityOwner(facilityId: string): Promise<User> {
  const user = await getFacilityOwner(facilityId);
  if (!user) redirect("/");
  return user;
}

/** 監査ログ記録（core.audit_logs、サービスロール）。 */
export async function writeAuditLog(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  domain: string | null = null,
  detail?: Record<string, unknown>,
) {
  const admin = createAdminClient();
  await admin
    .schema(SCHEMA.core)
    .from("audit_logs")
    .insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      domain,
      detail: detail ?? null,
    });
}
