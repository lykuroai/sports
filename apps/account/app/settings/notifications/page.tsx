import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { NotificationSettingsForm } from "./settings-form";

export default async function Page() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/settings/notifications");

  const { data } = await supabase
    .schema(SCHEMA.account)
    .from("notification_settings")
    .select("email_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  // 行が無ければ既定 true（受信する）。
  const emailEnabled = (data as { email_enabled?: boolean } | null)?.email_enabled ?? true;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">通知設定</h1>
      <p className="text-sm text-slate-600">全種目の通知を共通基盤で一元管理します。</p>
      <NotificationSettingsForm emailEnabled={emailEnabled} />
      <a href="/profile" className="text-brand hover:underline">← プロフィールへ戻る</a>
    </div>
  );
}
