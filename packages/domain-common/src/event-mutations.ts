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
  capacity: number;
  participation_fee: number;
  beginner_allowed: boolean;
  approval_type: "approval" | "first_come";
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

/**
 * 参加申請。先着順なら即承認、それ以外は申請中。主催者へ通知（共通 notifyUser 経由）。
 */
export async function applyToSportEvent(
  supabase: Client,
  schema: string,
  opts: { eventId: string; userId: string; message?: string | null; sportLabel: string },
): Promise<void> {
  const { eventId, userId, message, sportLabel } = opts;

  const { data: ev } = await supabase
    .schema(schema)
    .from("events")
    .select("organizer_id, approval_type, title")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev) return;

  const status = ev.approval_type === "first_come" ? "approved" : "applied";
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
  if (error) return;

  await notifyUser({
    userId: ev.organizer_id,
    type: "event_apply",
    title: "新しい参加申請があります",
    body: `${sportLabel}の「${ev.title}」に参加申請がありました。`,
    relatedType: `${schema}_event`,
    relatedId: eventId,
  });
}
