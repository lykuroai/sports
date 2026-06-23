"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";

export type NotifySettingsState = { error: string | null; ok?: boolean };

/**
 * 通知設定の保存。account.notification_settings を upsert（RLS notif_settings_self）。
 * email_enabled が false なら notifyUser はメール送信をスキップする（アプリ内通知は常に作成）。
 */
export async function updateNotificationSettings(
  _prev: NotifySettingsState,
  formData: FormData,
): Promise<NotifySettingsState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // チェックボックスは未チェック時に送信されない。値の有無で true/false を判定する。
  const emailEnabled = formData.get("email_enabled") === "on";

  const { error } = await supabase
    .schema(SCHEMA.account)
    .from("notification_settings")
    .upsert({ user_id: user.id, email_enabled: emailEnabled });
  if (error) return { error: error.message };

  revalidatePath("/settings/notifications");
  return { error: null, ok: true };
}
