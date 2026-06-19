import { createAdminClient, SCHEMA } from "@spotomo/auth-client";
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

  if (data?.email && data.status === "active") {
    await sendEmail({ to: data.email, subject: title, text: body ?? title });
  }
}
