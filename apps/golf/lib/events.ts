import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA } from "@spotomo/auth-client";
import { VISIBLE_EVENT_STATUSES, APPLYABLE_EVENT_STATUSES } from "@spotomo/shared-types";
import type { GolfEvent } from "@spotomo/shared-types";

// CLAUDE.md 方針: クライアントは untyped(SupabaseClient) で扱い、行はドメイン型へキャスト。
type Client = SupabaseClient;

const DOMAIN_SCHEMA = "golf";

export interface EventCardData extends GolfEvent {
  organizer_nickname: string | null;
  organizer_rating: number | null;
  facility_name: string | null;
  approved_count: number;
}

export interface EventFilter {
  keyword?: string;
  prefecture?: string;
  city?: string;
  beginnerOnly?: boolean;
  sort?: "soon" | "new" | "fee";
  limit?: number;
}

/** 公開中の golf イベント一覧。RLS で下書き/非公開は除外される。 */
export async function fetchEvents(supabase: Client, filter: EventFilter = {}): Promise<EventCardData[]> {
  let query = supabase
    .schema(DOMAIN_SCHEMA)
    .from("events")
    .select("*")
    .is("deleted_at", null)
    .in("status", VISIBLE_EVENT_STATUSES);

  if (filter.keyword) {
    query = query.or(`title.ilike.%${filter.keyword}%,description.ilike.%${filter.keyword}%`);
  }
  if (filter.prefecture) query = query.eq("prefecture", filter.prefecture);
  if (filter.city) query = query.eq("city", filter.city);
  if (filter.beginnerOnly) query = query.eq("beginner_allowed", true);

  switch (filter.sort) {
    case "new":
      query = query.order("created_at", { ascending: false });
      break;
    case "fee":
      query = query.order("participation_fee", { ascending: true });
      break;
    default:
      query = query.order("event_start_at", { ascending: true });
  }
  query = query.limit(filter.limit ?? 30);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as EventCardData[];
  await decorate(supabase, rows);
  return rows;
}

export async function fetchEventDetail(supabase: Client, id: string): Promise<EventCardData | null> {
  const { data, error } = await supabase
    .schema(DOMAIN_SCHEMA)
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as EventCardData;
  await decorate(supabase, [row]);
  return row;
}

export function isApplyable(status: GolfEvent["status"]): boolean {
  return APPLYABLE_EVENT_STATUSES.includes(status);
}

/** 主催者プロフィール(account)・施設名(facility)・承認済み人数(golf) を付与。 */
async function decorate(supabase: Client, rows: EventCardData[]) {
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);
  const organizerIds = [...new Set(rows.map((r) => r.organizer_id))];
  const facilityIds = [...new Set(rows.map((r) => r.facility_id).filter(Boolean))] as string[];

  const [{ data: parts }, { data: profiles }, { data: facilities }] = await Promise.all([
    supabase.schema(DOMAIN_SCHEMA).from("event_participants").select("event_id").in("event_id", ids).eq("status", "approved"),
    supabase.schema(SCHEMA.account).from("profiles").select("user_id, nickname, rating").in("user_id", organizerIds),
    facilityIds.length
      ? supabase.schema(SCHEMA.facility).from("facilities").select("id, name").in("id", facilityIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const counts = new Map<string, number>();
  for (const p of (parts ?? []) as { event_id: string }[]) {
    counts.set(p.event_id, (counts.get(p.event_id) ?? 0) + 1);
  }
  const profMap = new Map((profiles ?? []).map((p: { user_id: string; nickname: string; rating: number }) => [p.user_id, p]));
  const facMap = new Map((facilities ?? []).map((f: { id: string; name: string }) => [f.id, f.name]));

  for (const r of rows) {
    r.approved_count = counts.get(r.id) ?? 0;
    const prof = profMap.get(r.organizer_id);
    r.organizer_nickname = prof?.nickname ?? null;
    r.organizer_rating = prof?.rating ?? null;
    r.facility_name = r.facility_id ? (facMap.get(r.facility_id) ?? null) : null;
  }
}
