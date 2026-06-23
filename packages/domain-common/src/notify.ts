import { createAdminClient, SCHEMA } from "@spotomo/auth-client";
import { isPlaceholderEmail } from "@spotomo/shared-types";
import { sendEmail } from "./email";

/**
 * アプリ内通知の作成 + メール送信（仕様 §6.8）。種目横断の共通機能。
 *
 * core.notifications には INSERT 用 RLS ポリシーが無く、他ユーザー宛の通知は
 * セッションクライアントからは作成できない。サービスロールで作成し、併せて
 * account.users.email 宛にメールを送る（メールは best-effort）。
 * 呼び出し元の Server Action 側で操作者の正当性を検証していること。
 */
export async function notifyUser({
  userId,
  type,
  title,
  body,
  relatedType,
  relatedId,
}: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  relatedType?: string;
  relatedId?: string;
}): Promise<void> {
  const db = createAdminClient();

  await db
    .schema(SCHEMA.core)
    .from("notifications")
    .insert({
      user_id: userId,
      notification_type: type,
      title,
      body: body ?? null,
      related_type: relatedType ?? null,
      related_id: relatedId ?? null,
    });

  const { data } = await db
    .schema(SCHEMA.account)
    .from("users")
    .select("email, status")
    .eq("id", userId)
    .maybeSingle();

  // ユーザーの通知設定（account.notification_settings.email_enabled）を尊重する。
  // 行が無い場合は既定 true（受信する）。アプリ内通知は設定に関わらず常に作成する。
  const { data: settings } = await db
    .schema(SCHEMA.account)
    .from("notification_settings")
    .select("email_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  const emailEnabled = (settings as { email_enabled?: boolean } | null)?.email_enabled ?? true;

  // 合成メール（プレースホルダ）には送らない（実在せずバウンスするため）。
  if (emailEnabled && data?.email && data.status === "active" && !isPlaceholderEmail(data.email)) {
    await sendEmail({ to: data.email, subject: title, text: body ?? title });
  }
}
