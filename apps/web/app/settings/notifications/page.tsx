import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { fetchPublishedSports } from "@spotomo/domain-common";
import { NotificationSettingsForm } from "./settings-form";
import { NewRecruitmentForm } from "./new-recruitment-form";

export default async function Page() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/settings/notifications");

  const [settingsRes, sports] = await Promise.all([
    supabase
      .schema(SCHEMA.account)
      .from("notification_settings")
      .select("email_enabled, prefs")
      .eq("user_id", user.id)
      .maybeSingle(),
    fetchPublishedSports(supabase),
  ]);
  const data = settingsRes.data as
    | { email_enabled?: boolean; prefs?: { new_recruitment_sport_ids?: string[] } }
    | null;
  // 行が無ければ既定 true（受信する）。
  const emailEnabled = data?.email_enabled ?? true;
  // 新規募集メールはオプトイン制（既定は空＝受信しない）。
  const newRecruitmentSportIds = data?.prefs?.new_recruitment_sport_ids ?? [];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">通知設定</h1>
        <p className="text-sm text-slate-600">全種目の通知を共通基盤で一元管理します。</p>
      </div>
      <NotificationSettingsForm emailEnabled={emailEnabled} />
      <NewRecruitmentForm sports={sports} selectedSportIds={newRecruitmentSportIds} />
      <a href="/profile" className="text-brand hover:underline">← プロフィールへ戻る</a>
    </div>
  );
}
