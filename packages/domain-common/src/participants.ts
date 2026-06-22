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
  // 承認判断の材料として主催者に見せる公開プロフィール特性（§15.3 に従い、
  // 本名・正確な生年月日・連絡先は含めない。住所は都道府県相当の area のみ）。
  gender: string | null;
  age_range: string | null;
  area: string | null;
  sport_ids: string[];
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

  type BaseRow = Pick<ParticipantRow, "user_id" | "status" | "application_message" | "applied_at">;
  const rows = (parts ?? []) as BaseRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .schema(SCHEMA.account)
    .from("profiles")
    .select("user_id, nickname, rating, gender, age_range, area")
    .in("user_id", ids);
  type ProfileRow = {
    user_id: string;
    nickname: string | null;
    rating: number | null;
    gender: string | null;
    age_range: string | null;
    area: string | null;
  };
  const map = new Map((profiles ?? []).map((p: ProfileRow) => [p.user_id, p]));

  // 申請者の登録種目（趣味）。条件との一致判定に使う。
  const { data: us } = await supabase
    .schema(SCHEMA.core)
    .from("user_sports")
    .select("user_id, sport_id")
    .in("user_id", ids);
  const sportMap = new Map<string, string[]>();
  for (const r of (us ?? []) as { user_id: string; sport_id: string }[]) {
    sportMap.set(r.user_id, [...(sportMap.get(r.user_id) ?? []), r.sport_id]);
  }

  return rows.map((r) => {
    const p = map.get(r.user_id);
    return {
      ...r,
      nickname: p?.nickname ?? null,
      rating: p?.rating ?? null,
      gender: p?.gender ?? null,
      age_range: p?.age_range ?? null,
      area: p?.area ?? null,
      sport_ids: sportMap.get(r.user_id) ?? [],
    };
  });
}

export interface EventConditions {
  gender_condition: string;
  skill_level: string;
  condition_prefectures: string[];
  condition_sport_ids: string[];
  condition_sport_names: string[];
  /** いずれかの条件が設定されているか（プレミアム会員の募集か）。 */
  hasConditions: boolean;
}

/** イベントに設定された参加者条件（承認画面で一致判定の基準に使う）。 */
export async function fetchEventConditions(
  supabase: Client,
  schema: string,
  eventId: string,
): Promise<EventConditions> {
  const { data } = await supabase
    .schema(schema)
    .from("events")
    .select("gender_condition, skill_level, condition_prefectures, condition_sport_ids")
    .eq("id", eventId)
    .maybeSingle();
  const ev = (data ?? {}) as {
    gender_condition?: string;
    skill_level?: string;
    condition_prefectures?: string[];
    condition_sport_ids?: string[];
  };
  const sportIds = ev.condition_sport_ids ?? [];
  let names: string[] = [];
  if (sportIds.length > 0) {
    const { data: sports } = await supabase
      .schema(SCHEMA.core)
      .from("sports")
      .select("id, name")
      .in("id", sportIds);
    names = ((sports ?? []) as { name: string }[]).map((s) => s.name);
  }
  const genderCondition = ev.gender_condition ?? "unspecified";
  const skillLevel = ev.skill_level ?? "any";
  const prefectures = ev.condition_prefectures ?? [];
  return {
    gender_condition: genderCondition,
    skill_level: skillLevel,
    condition_prefectures: prefectures,
    condition_sport_ids: sportIds,
    condition_sport_names: names,
    hasConditions:
      genderCondition !== "unspecified" ||
      skillLevel !== "any" ||
      prefectures.length > 0 ||
      sportIds.length > 0,
  };
}

export interface EventMember {
  user_id: string;
  nickname: string | null;
  rating: number | null;
  role: "organizer" | "participant";
}

/**
 * イベントのメンバー一覧（発起者＋承認済み参加者）。承認済みメンバー同士で
 * 相互公開する用途。返すのは公開情報（ニックネーム・評価）のみで、連絡先は含めない。
 * RLS により非メンバーは承認済み参加者行を読めないため、結果は発起者のみに縮退する。
 */
export async function fetchEventMembers(
  supabase: Client,
  schema: string,
  eventId: string,
): Promise<EventMember[]> {
  const { data: ev } = await supabase
    .schema(schema)
    .from("events")
    .select("organizer_id")
    .eq("id", eventId)
    .maybeSingle();
  const organizerId = (ev as { organizer_id: string } | null)?.organizer_id ?? null;

  const { data: parts } = await supabase
    .schema(schema)
    .from("event_participants")
    .select("user_id, approved_at")
    .eq("event_id", eventId)
    .eq("status", "approved")
    .order("approved_at", { ascending: true });
  const participantIds = ((parts ?? []) as { user_id: string }[])
    .map((p) => p.user_id)
    .filter((uid) => uid !== organizerId);

  const ids = [...new Set([organizerId, ...participantIds].filter(Boolean) as string[])];
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .schema(SCHEMA.account)
    .from("profiles")
    .select("user_id, nickname, rating")
    .in("user_id", ids);
  const map = new Map(
    (profiles ?? []).map((p: { user_id: string; nickname: string; rating: number }) => [p.user_id, p]),
  );

  const member = (uid: string, role: EventMember["role"]): EventMember => ({
    user_id: uid,
    nickname: map.get(uid)?.nickname ?? null,
    rating: map.get(uid)?.rating ?? null,
    role,
  });

  const members: EventMember[] = [];
  if (organizerId) members.push(member(organizerId, "organizer"));
  for (const uid of participantIds) members.push(member(uid, "participant"));
  return members;
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

  // 承認済みを取り消す場合はチャットからも退出させる（承認時に参加済みのため）。
  // 申請中→拒否では対象行が無く no-op。chat_room_members には更新用 RLS が無いためサービスロールで行う。
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
      .eq("user_id", applicantId);
  }

  await notifyUser({
    userId: applicantId,
    type: "event_rejected",
    title: "参加申請の結果",
    body: `${sportLabel}の「${eventTitle}」への参加は見送り／取り消しとなりました。`,
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
