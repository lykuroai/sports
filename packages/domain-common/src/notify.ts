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

/**
 * 新規募集（=公開された種目イベント）を、その種目の通知を希望しているユーザへ一斉通知する。
 * オプトイン制：`account.notification_settings.prefs.new_recruitment_sport_ids`（uuid 配列）に
 * 当該種目を含むユーザのみが対象（設定行が無いユーザには送らない＝既定オフ）。
 *
 * アプリ内通知は対象者全員に作成し、メールは `email_enabled` かつ実在メールのユーザにのみ送る。
 * 非公開募集・種目未設定（sportId なし）は対象外。主催者本人は除外する。
 * 募集作成のトランザクションを壊さないよう、呼び出し側で失敗を握りつぶすこと（best-effort）。
 */
export async function notifyNewRecruitmentSubscribers(opts: {
  /** 種目スキーマ名（"running" など）。related_type の組み立てに使う。 */
  schema: string;
  eventId: string;
  /** 募集の種目（core.sports.id）。null なら配信しない。 */
  sportId: string | null;
  title: string;
  /** 主催者（自分の募集の通知は受け取らない）。 */
  organizerId: string;
  /** 募集の公開範囲。"public" 以外は配信しない。未指定は公開扱い。 */
  visibility?: string | null;
}): Promise<void> {
  const { schema, eventId, sportId, title, organizerId, visibility } = opts;
  if (!sportId) return;
  if (visibility && visibility !== "public") return;

  const db = createAdminClient();

  // この種目の新規募集メールを希望しているユーザ（オプトイン）。
  const { data: subs } = await db
    .schema(SCHEMA.account)
    .from("notification_settings")
    .select("user_id, email_enabled")
    .contains("prefs", { new_recruitment_sport_ids: [sportId] });
  const recipients = ((subs ?? []) as { user_id: string; email_enabled: boolean }[]).filter(
    (s) => s.user_id !== organizerId,
  );
  if (recipients.length === 0) return;

  // メール文面用の種目名。
  const { data: sport } = await db
    .schema(SCHEMA.core)
    .from("sports")
    .select("name")
    .eq("id", sportId)
    .maybeSingle();
  const sportName = (sport as { name?: string } | null)?.name ?? "スポーツ";

  const notifTitle = `${sportName}の新しい募集`;
  const notifBody = `${sportName}で新しい募集「${title}」が公開されました。`;

  // アプリ内通知は対象者全員に一括作成（メール可否に関わらず）。
  await db.schema(SCHEMA.core).from("notifications").insert(
    recipients.map((r) => ({
      user_id: r.user_id,
      notification_type: "new_recruitment",
      title: notifTitle,
      body: notifBody,
      related_type: `${schema}_event`,
      related_id: eventId,
    })),
  );

  // メールは email_enabled かつ実在メールのユーザにのみ送る。
  const emailUserIds = recipients.filter((r) => r.email_enabled).map((r) => r.user_id);
  if (emailUserIds.length === 0) return;
  const { data: users } = await db
    .schema(SCHEMA.account)
    .from("users")
    .select("email, status")
    .in("id", emailUserIds);
  const targets = ((users ?? []) as { email: string | null; status: string }[]).filter(
    (u) => u.email && u.status === "active" && !isPlaceholderEmail(u.email),
  );
  await Promise.all(
    targets.map((u) => sendEmail({ to: u.email as string, subject: notifTitle, text: notifBody })),
  );
}
