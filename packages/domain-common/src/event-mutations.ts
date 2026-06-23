import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@spotomo/auth-client";
import { notifyUser } from "./notify";

type Client = SupabaseClient;

export interface CreateEventInput {
  organizer_id: string;
  title: string;
  description?: string | null;
  prefecture?: string | null;
  city?: string | null;
  event_start_at: string; // ISO
  /** 申請締切日時（ISO）。この日時を過ぎると参加申請できない。未指定なら締切なし。 */
  application_deadline?: string | null;
  capacity: number;
  participation_fee: number;
  beginner_allowed: boolean;
  approval_type: "approval" | "first_come";
  /**
   * 参加者条件（プレミアム会員のみ有効。非会員の値は DB トリガー
   * enforce_event_premium が無効化する）。未指定なら条件なし。
   */
  gender_condition?: "male" | "female" | "other" | "unspecified";
  skill_level?: "beginner" | "intermediate" | "advanced" | "any";
  condition_prefectures?: string[];
  condition_sport_ids?: string[];
  /** 種目固有の追加列（golf: tee_time 等 / running: target_pace / outdoor: activity_type）。 */
  extra?: Record<string, unknown>;
}

/**
 * 種目イベント（=仲間募集）を作成し、イベント単位のグループチャットを用意する。
 * 共通列のみ挿入し、種目固有列は extra で渡す。戻り値は新規イベント ID。
 */
export async function createSportEvent(
  supabase: Client,
  schema: string,
  input: CreateEventInput,
): Promise<{ id: string } | { error: string }> {
  const { extra, ...common } = input;
  const { data, error } = await supabase
    .schema(schema)
    .from("events")
    .insert({ ...common, ...(extra ?? {}), status: "open" })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // chat_rooms / chat_room_members には INSERT 用 RLS が無いため、ルーム作成と
  // 主催者のメンバー登録はサービスロールで行う（approveParticipant と同じ方針）。
  const admin = createAdminClient();
  const { data: room } = await admin
    .schema(schema)
    .from("chat_rooms")
    .insert({ event_id: data.id })
    .select("id")
    .single();
  if (room) {
    await admin
      .schema(schema)
      .from("chat_room_members")
      .insert({ chat_room_id: room.id, user_id: input.organizer_id, role: "organizer" });
  }
  return { id: data.id as string };
}

/** 承認済み参加者数を数える（任意で指定ユーザーを除外）。定員判定に使う。 */
async function countApproved(
  supabase: Client,
  schema: string,
  eventId: string,
  excludeUserId?: string,
): Promise<number> {
  let q = supabase
    .schema(schema)
    .from("event_participants")
    .select("user_id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "approved");
  if (excludeUserId) q = q.neq("user_id", excludeUserId);
  const { count } = await q;
  return count ?? 0;
}

/**
 * 参加申請。先着順は定員に空きがあれば即承認、満員ならキャンセル待ち。承認制は申請中。
 * 主催者へ通知（共通 notifyUser 経由）。戻り値で確定した参加ステータスを返す。
 */
export async function applyToSportEvent(
  supabase: Client,
  schema: string,
  opts: { eventId: string; userId: string; message?: string | null; sportLabel: string },
): Promise<"applied" | "approved" | "waitlist" | "closed" | null> {
  const { eventId, userId, message, sportLabel } = opts;

  const { data: ev } = await supabase
    .schema(schema)
    .from("events")
    .select("organizer_id, approval_type, title, capacity, application_deadline")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev) return null;

  // 締切日時を過ぎた募集には申請できない。
  if (ev.application_deadline && new Date(ev.application_deadline) < new Date()) {
    return "closed";
  }

  let status: "applied" | "approved" | "waitlist";
  if (ev.approval_type === "first_come") {
    // 先着順は即承認だが、定員を超えないようキャンセル待ちへ振り分ける。
    // 自分の既存承認行は除外して数える（再申請の二重計上を防ぐ）。
    const approved = await countApproved(supabase, schema, eventId, userId);
    status = approved >= (ev.capacity ?? 0) ? "waitlist" : "approved";
  } else {
    status = "applied";
  }

  const { error } = await supabase
    .schema(schema)
    .from("event_participants")
    .upsert({
      event_id: eventId,
      user_id: userId,
      status,
      application_message: message || null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    });
  if (error) return null;

  // 即承認ならチャットに参加させる（承認制の approveParticipant と同じ扱い）。
  if (status === "approved") {
    const admin = createAdminClient();
    const { data: room } = await admin
      .schema(schema)
      .from("chat_rooms")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();
    if (room) {
      await admin
        .schema(schema)
        .from("chat_room_members")
        .upsert({ chat_room_id: room.id, user_id: userId, role: "participant" });
    }
  }

  // 主催者へ通知（新規申請）。
  await notifyUser({
    userId: ev.organizer_id,
    type: "event_apply",
    title: "新しい参加申請があります",
    body: `${sportLabel}の「${ev.title}」に参加申請がありました。`,
    relatedType: `${schema}_event`,
    relatedId: eventId,
  });

  // 申請者本人へも確定状態に応じた確認メール／通知を送る。
  const selfMessage =
    status === "approved"
      ? { type: "event_apply_confirmed", title: "参加が確定しました", body: `${sportLabel}の「${ev.title}」への参加が確定しました。` }
      : status === "waitlist"
        ? { type: "event_apply_waitlist", title: "キャンセル待ちに登録しました", body: `${sportLabel}の「${ev.title}」は満員のためキャンセル待ちに登録しました。空きが出ると参加できる場合があります。` }
        : { type: "event_apply_received", title: "参加申請を受け付けました", body: `${sportLabel}の「${ev.title}」への参加申請を受け付けました。主催者の承認をお待ちください。` };
  await notifyUser({
    userId,
    ...selfMessage,
    relatedType: `${schema}_event`,
    relatedId: eventId,
  });
}
