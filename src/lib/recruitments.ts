import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecruitmentListItem } from "@/components/recruitment-card";

// 手書きの database.types は supabase-js の型契約と完全一致しないため、
// クライアントは untyped(SupabaseClient) として扱い、行はアプリ側の
// ドメイン型へキャストする方針とする。
type Client = SupabaseClient;

export type RecruitmentSort = "soon" | "new" | "fee" | "few_left";

export interface RecruitmentFilter {
  keyword?: string;
  sportSlug?: string;
  prefecture?: string;
  city?: string;
  beginnerOnly?: boolean;
  openOnly?: boolean;
  sort?: RecruitmentSort;
  limit?: number;
}

const SELECT = `
  *,
  sports:sport_id ( name, slug ),
  facilities:facility_id ( name ),
  profiles:organizer_id ( display_name, rating )
` as const;

/** 公開募集の一覧を、条件・並び替え付きで取得し、承認済み人数を付与する */
export async function fetchRecruitments(
  supabase: Client,
  filter: RecruitmentFilter = {},
): Promise<RecruitmentListItem[]> {
  let query = supabase
    .from("recruitments")
    // RLS により下書き/非公開は自動的に除外される
    .select(SELECT)
    .is("deleted_at", null)
    .in("status", ["open", "few_left", "full", "waitlist"]);

  if (filter.keyword) {
    query = query.or(`title.ilike.%${filter.keyword}%,description.ilike.%${filter.keyword}%`);
  }
  if (filter.prefecture) query = query.eq("prefecture", filter.prefecture);
  if (filter.city) query = query.eq("city", filter.city);
  if (filter.beginnerOnly) query = query.eq("beginner_allowed", true);
  if (filter.openOnly) query = query.in("status", ["open", "few_left"]);

  if (filter.sportSlug) {
    const { data: sport } = await supabase
      .from("sports")
      .select("id")
      .eq("slug", filter.sportSlug)
      .maybeSingle();
    if (sport) query = query.eq("sport_id", sport.id);
    else return [];
  }

  switch (filter.sort) {
    case "new":
      query = query.order("created_at", { ascending: false });
      break;
    case "fee":
      query = query.order("participation_fee", { ascending: true });
      break;
    case "soon":
    default:
      query = query.order("event_start_at", { ascending: true });
  }

  query = query.limit(filter.limit ?? 30);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as RecruitmentListItem[];

  await attachApprovedCounts(supabase, rows);
  return rows;
}

/** 募集ID群に承認済み参加者数を付与する */
async function attachApprovedCounts(supabase: Client, rows: RecruitmentListItem[]) {
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);
  const { data } = await supabase
    .from("recruitment_participants")
    .select("recruitment_id")
    .in("recruitment_id", ids)
    .eq("status", "approved");

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { recruitment_id: string }[]) {
    counts.set(row.recruitment_id, (counts.get(row.recruitment_id) ?? 0) + 1);
  }
  for (const r of rows) r.approved_count = counts.get(r.id) ?? 0;
}

/** 募集詳細を取得（見つからなければ null） */
export async function fetchRecruitmentDetail(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("recruitments")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as RecruitmentListItem;
  await attachApprovedCounts(supabase, [row]);
  return row;
}
