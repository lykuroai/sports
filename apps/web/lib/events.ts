import { makeEventRepo, isApplyable } from "@spotomo/domain-common";
import type { DecoratedEvent, EventFilter } from "@spotomo/domain-common";
import { SCHEMA } from "@spotomo/auth-client";
import { VISIBLE_EVENT_STATUSES } from "@spotomo/shared-types";
import type { SupabaseClient } from "@supabase/supabase-js";

// ランニング イベントの取得は共通リポジトリ（domain-common）を schema='running' で利用。
const repo = makeEventRepo("running");

/**
 * 都道府県ごとの募集件数を集計（「地域から探す」の件数表示用）。fetchEvents と同じ
 * 可視条件（公開中ステータス・未削除・期限切れ除外）で数える。sportIds 指定で種目に限定。
 */
export async function countRecruitmentsByPrefecture(
  supabase: SupabaseClient,
  sportIds?: string[] | null,
): Promise<Map<string, number>> {
  const nowIso = new Date().toISOString();
  let q = supabase
    .schema(SCHEMA.running)
    .from("events")
    .select("prefecture")
    .is("deleted_at", null)
    .in("status", VISIBLE_EVENT_STATUSES)
    .not("prefecture", "is", null)
    .or(`application_deadline.gte.${nowIso},and(application_deadline.is.null,event_start_at.gte.${nowIso})`)
    .limit(5000);
  if (sportIds) q = q.in("sport_id", sportIds.length ? sportIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { prefecture: string | null }[]) {
    if (r.prefecture) counts.set(r.prefecture, (counts.get(r.prefecture) ?? 0) + 1);
  }
  return counts;
}

export const fetchEvents = repo.fetchEvents;
export const fetchEventDetail = repo.fetchEventDetail;
export { isApplyable };
export type { EventFilter };
export type EventCardData = DecoratedEvent;
