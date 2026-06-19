import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, SCHEMA } from "@spotomo/auth-client";
import { notifyUser } from "./notify";

type Client = SupabaseClient;

export interface ParticipantRow {
  user_id: string;
  status: string;
  application_message: string | null;
  applied_at: string;
  nickname: string | null;
  rating: number | null;
}

/** 当該イベントの参加者一覧（主催者向け。RLS で主催者のみ全件読める）。 */
export async function fetchParticipants(
  supabase: Client,
  schema: string,
  eventId: string,
): Promise<ParticipantRow[]> {
  const { data: parts } = await supabase
    .schema(schema)
    .from("event_participants")
    .select("user_id, status, application_message, applied_at")
    .eq("event_id", eventId)
    .order("applied_at", { ascending: true });

  const rows = (parts ?? []) as Omit<ParticipantRow, "nickname" | "rating">[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .schema(SCHEMA.account)
    .from("profiles")
    .select("user_id, nickname, rating")
    .in("user_id", ids);
  const map = new Map(
    (profiles ?? []).map((p: { user_id: string; nickname: string; rating: number }) => [p.user_id, p]),
  );

  return rows.map((r) => ({
    ...r,
    nickname: map.get(r.user_id)?.nickname ?? null,
    rating: map.get(r.user_id)?.rating ?? null,
  }));
}

/**
 * 参加承認。ステータス更新は主催者セッション（RLS）で、チャット参加と通知は
 * サービスロールで行う（chat_room_members には INSERT 用 RLS が無いため）。
 */
export async function approveParticipant(
  supabase: Client,
  schema: string,
  opts: { eventId: string; applicantId: string; sportLabel: string; eventTitle: string },
): Promise<{ error: string | null }> {
  const { eventId, applicantId, sportLabel, eventTitle } = opts;
  const { error } = await supabase
    .schema(schema)
    .from("event_participants")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("user_id", applicantId);
  if (error) return { error: error.message };

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
      .upsert({ chat_room_id: room.id, user_id: applicantId, role: "participant" });
  }

  await notifyUser({
    userId: applicantId,
    type: "event_approved",
    title: "参加が承認されました",
    body: `${sportLabel}の「${eventTitle}」への参加が承認されました。`,
    relatedType: `${schema}_event`,
    relatedId: eventId,
  });
  return { error: null };
}

export async function rejectParticipant(
  supabase: Client,
  schema: string,
  opts: { eventId: string; applicantId: string; sportLabel: string; eventTitle: string },
): Promise<{ error: string | null }> {
  const { eventId, applicantId, sportLabel, eventTitle } = opts;
  const { error } = await supabase
    .schema(schema)
    .from("event_participants")
    .update({ status: "rejected" })
    .eq("event_id", eventId)
    .eq("user_id", applicantId);
  if (error) return { error: error.message };

  await notifyUser({
    userId: applicantId,
    type: "event_rejected",
    title: "参加申請の結果",
    body: `${sportLabel}の「${eventTitle}」への参加は今回は見送りとなりました。`,
    relatedType: `${schema}_event`,
    relatedId: eventId,
  });
  return { error: null };
}

/** 参加者本人によるキャンセル。チャットからの退出はサービスロールで行う。 */
export async function cancelParticipation(
  supabase: Client,
  schema: string,
  opts: { eventId: string; userId: string },
): Promise<{ error: string | null }> {
  const { eventId, userId } = opts;
  const { error } = await supabase
    .schema(schema)
    .from("event_participants")
    .update({ status: "cancelled_self", cancelled_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

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
      .update({ left_at: new Date().toISOString() })
      .eq("chat_room_id", room.id)
      .eq("user_id", userId);
  }
  return { error: null };
}
