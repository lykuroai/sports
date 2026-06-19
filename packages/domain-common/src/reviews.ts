import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA } from "@spotomo/auth-client";

type Client = SupabaseClient;

export interface ReviewTarget {
  user_id: string;
  nickname: string | null;
  already_reviewed: boolean;
}

/**
 * 相互評価の対象一覧（当該イベントの主催者＋承認済み参加者から自分を除く）。
 * 開催が過去 or status='finished' かつ自分がメンバーである場合に利用する想定。
 */
export async function fetchReviewTargets(
  supabase: Client,
  schema: string,
  eventId: string,
  selfId: string,
): Promise<ReviewTarget[]> {
  const { data: ev } = await supabase
    .schema(schema)
    .from("events")
    .select("organizer_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev) return [];

  const { data: parts } = await supabase
    .schema(schema)
    .from("event_participants")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("status", "approved");

  const ids = new Set<string>([ev.organizer_id, ...(parts ?? []).map((p: { user_id: string }) => p.user_id)]);
  ids.delete(selfId);
  const memberIds = [...ids];
  if (memberIds.length === 0) return [];

  const [{ data: profiles }, { data: reviews }] = await Promise.all([
    supabase.schema(SCHEMA.account).from("profiles").select("user_id, nickname").in("user_id", memberIds),
    supabase
      .schema(schema)
      .from("user_reviews")
      .select("reviewee_id")
      .eq("event_id", eventId)
      .eq("reviewer_id", selfId),
  ]);

  const nameMap = new Map((profiles ?? []).map((p: { user_id: string; nickname: string }) => [p.user_id, p.nickname]));
  const reviewed = new Set((reviews ?? []).map((r: { reviewee_id: string }) => r.reviewee_id));

  return memberIds.map((id) => ({
    user_id: id,
    nickname: nameMap.get(id) ?? null,
    already_reviewed: reviewed.has(id),
  }));
}

/** 相互評価を投稿。集計（account.profiles.rating）は DB トリガーが行う。 */
export async function submitReview(
  supabase: Client,
  schema: string,
  input: {
    eventId: string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    tags?: string[];
    comment?: string | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .schema(schema)
    .from("user_reviews")
    .upsert({
      event_id: input.eventId,
      reviewer_id: input.reviewerId,
      reviewee_id: input.revieweeId,
      rating: input.rating,
      tags: input.tags ?? null,
      comment: input.comment || null,
    });
  return { error: error?.message ?? null };
}
