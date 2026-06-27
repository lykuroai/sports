import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA, createAdminClient } from "@spotomo/auth-client";
import {
  APPLYABLE_EVENT_STATUSES,
  VISIBLE_EVENT_STATUSES,
  type EventStatus,
  type SportEventBase,
} from "@spotomo/shared-types";

// 種目イベントの取得ロジックは全種目で共通（テーブルはスキーマで分かれる）。
// CLAUDE.md 方針に従い untyped(SupabaseClient) で扱い、行はドメイン型へキャスト。
type Client = SupabaseClient;

export interface DecoratedEvent extends SportEventBase {
  organizer_nickname: string | null;
  organizer_rating: number | null;
  facility_name: string | null;
  approved_count: number;
  /** 定員を占有している人数（申請中＋承認済み＋キャンセル待ち）。満員判定に使う。 */
  active_count: number;
}

export interface EventFilter {
  keyword?: string;
  prefecture?: string;
  city?: string;
  beginnerOnly?: boolean;
  /** 種目(sport_id)で絞り込む。空配列なら 0 件、未指定なら絞り込まない。 */
  sportIds?: string[];
  sort?: "soon" | "new" | "fee";
  limit?: number;
}

export function isApplyable(status: EventStatus): boolean {
  return APPLYABLE_EVENT_STATUSES.includes(status);
}

/**
 * 種目スキーマ（'golf' | 'running' | 'outdoor' | ...）を渡すと、その種目の
 * イベント取得リポジトリを返す。種目追加時はスキーマ名を渡すだけで再利用できる。
 */
export function makeEventRepo(schema: string) {
  async function fetchEvents(supabase: Client, filter: EventFilter = {}): Promise<DecoratedEvent[]> {
    let query = supabase
      .schema(schema)
      .from("events")
      .select("*")
      .is("deleted_at", null)
      .in("status", VISIBLE_EVENT_STATUSES);

    // 期限切れの募集は一覧に出さない。「期限」は申込期限(application_deadline)を優先し、
    // 未設定なら開催日時(event_start_at)を期限とみなす。どちらも現在時刻を過ぎたら除外。
    const nowIso = new Date().toISOString();
    query = query.or(
      `application_deadline.gte.${nowIso},and(application_deadline.is.null,event_start_at.gte.${nowIso})`,
    );

    if (filter.keyword) {
      query = query.or(`title.ilike.%${filter.keyword}%,description.ilike.%${filter.keyword}%`);
    }
    if (filter.prefecture) query = query.eq("prefecture", filter.prefecture);
    if (filter.city) query = query.eq("city", filter.city);
    if (filter.beginnerOnly) query = query.eq("beginner_allowed", true);
    if (filter.sportIds) query = query.in("sport_id", filter.sportIds.length ? filter.sportIds : ["00000000-0000-0000-0000-000000000000"]);

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
    const rows = (data ?? []) as unknown as DecoratedEvent[];
    await decorate(supabase, schema, rows);
    return rows;
  }

  async function fetchEventDetail(supabase: Client, id: string): Promise<DecoratedEvent | null> {
    const { data, error } = await supabase
      .schema(schema)
      .from("events")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as DecoratedEvent;
    await decorate(supabase, schema, [row]);
    return row;
  }

  return { fetchEvents, fetchEventDetail };
}

/** 主催者プロフィール(account)・施設名(facility)・承認済み人数(種目) を付与。 */
export async function decorateEvents(supabase: Client, schema: string, rows: DecoratedEvent[]) {
  return decorate(supabase, schema, rows);
}

async function decorate(supabase: Client, schema: string, rows: DecoratedEvent[]) {
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);
  const organizerIds = [...new Set(rows.map((r) => r.organizer_id))];
  const facilityIds = [...new Set(rows.map((r) => r.facility_id).filter(Boolean))] as string[];

  // 承認済み人数の集計はサービスロールで行う。event_participants の SELECT 用 RLS は
  // 「本人 or 主催者 or 管理者」しか読めないため、一般の閲覧者がセッションクライアントで
  // 数えると自分の行しか見えず n が 0 や過少になる（定員 n/m の表示崩れ）。承認済み人数は
  // 元々公開情報なのでサービスロールで集計してよい。
  const admin = createAdminClient();
  const [{ data: parts }, { data: profiles }, { data: facilities }] = await Promise.all([
    admin.schema(schema).from("event_participants").select("event_id, status").in("event_id", ids)
      .in("status", ["applied", "approved", "waitlist"]),
    supabase.schema(SCHEMA.account).from("profiles").select("user_id, nickname, rating").in("user_id", organizerIds),
    facilityIds.length
      ? supabase.schema(SCHEMA.facility).from("facilities").select("id, name").in("id", facilityIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  // 承認済み人数（approved_count）と、定員を占有する人数（active_count = 申請中＋承認済み＋
  // キャンセル待ち）を別々に集計する。
  const counts = new Map<string, number>();
  const activeCounts = new Map<string, number>();
  for (const p of (parts ?? []) as { event_id: string; status: string }[]) {
    activeCounts.set(p.event_id, (activeCounts.get(p.event_id) ?? 0) + 1);
    if (p.status === "approved") counts.set(p.event_id, (counts.get(p.event_id) ?? 0) + 1);
  }
  const profMap = new Map(
    (profiles ?? []).map((p: { user_id: string; nickname: string; rating: number }) => [p.user_id, p]),
  );
  const facMap = new Map((facilities ?? []).map((f: { id: string; name: string }) => [f.id, f.name]));

  for (const r of rows) {
    r.approved_count = counts.get(r.id) ?? 0;
    r.active_count = activeCounts.get(r.id) ?? 0;
    const prof = profMap.get(r.organizer_id);
    r.organizer_nickname = prof?.nickname ?? null;
    r.organizer_rating = prof?.rating ?? null;
    r.facility_name = r.facility_id ? (facMap.get(r.facility_id) ?? null) : null;
  }
}
