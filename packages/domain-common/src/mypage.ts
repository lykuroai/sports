import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA } from "@spotomo/auth-client";
import { decorateEvents, type DecoratedEvent } from "./events";

// マイページ（ダッシュボード）のデータ取得。種目スキーマ（'golf' 等）を渡して再利用する。
// 募集・参加・お気に入りは種目ごと、フォロー/フォロワーはアカウント横断（core.follows）。
type Client = SupabaseClient;

// 参加中とみなすステータス（申請中・承認済み・キャンセル待ち）。
const ACTIVE_PARTICIPANT_STATUSES = ["applied", "approved", "waitlist"] as const;

export interface MypageCounts {
  organized: number;
  participating: number;
  favorites: number;
  following: number;
  followers: number;
}

/** ダッシュボードの各カウントをまとめて取得。 */
export async function fetchMypageCounts(
  supabase: Client,
  schema: string,
  userId: string,
): Promise<MypageCounts> {
  const [organized, partRows, favorites, following, followers] = await Promise.all([
    supabase.schema(schema).from("events")
      .select("id", { count: "exact", head: true })
      .eq("organizer_id", userId).is("deleted_at", null),
    // 参加は「私の参加」一覧と一致させる必要があるため、参加行の event_id を取得し、
    // 削除されていない募集だけを数える（一覧は deleted_at is null で絞っているため）。
    supabase.schema(schema).from("event_participants")
      .select("event_id")
      .eq("user_id", userId).in("status", ACTIVE_PARTICIPANT_STATUSES),
    supabase.schema(SCHEMA.core).from("favorites")
      .select("target_id", { count: "exact", head: true })
      .eq("user_id", userId).eq("target_type", "recruitment").eq("domain", schema),
    supabase.schema(SCHEMA.core).from("follows")
      .select("followee_id", { count: "exact", head: true })
      .eq("follower_id", userId),
    supabase.schema(SCHEMA.core).from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("followee_id", userId),
  ]);

  // 参加中の募集のうち、削除されていないものだけを数える。
  const partIds = [...new Set((partRows.data ?? []).map((p: { event_id: string }) => p.event_id))];
  let participating = 0;
  if (partIds.length > 0) {
    const { count } = await supabase
      .schema(schema).from("events")
      .select("id", { count: "exact", head: true })
      .in("id", partIds).is("deleted_at", null);
    participating = count ?? 0;
  }

  return {
    organized: organized.count ?? 0,
    participating,
    favorites: favorites.count ?? 0,
    following: following.count ?? 0,
    followers: followers.count ?? 0,
  };
}

/** 私が主催した募集（下書き・終了含む。新しい順）。 */
export async function fetchMyOrganizedEvents(
  supabase: Client,
  schema: string,
  userId: string,
): Promise<DecoratedEvent[]> {
  const { data } = await supabase
    .schema(schema).from("events").select("*")
    .eq("organizer_id", userId).is("deleted_at", null)
    .order("event_start_at", { ascending: false });
  const rows = (data ?? []) as unknown as DecoratedEvent[];
  await decorateEvents(supabase, schema, rows);
  return rows;
}

/** 私が参加（申請中・承認済み・キャンセル待ち）している募集。 */
export async function fetchMyParticipatingEvents(
  supabase: Client,
  schema: string,
  userId: string,
): Promise<DecoratedEvent[]> {
  const { data: parts } = await supabase
    .schema(schema).from("event_participants").select("event_id")
    .eq("user_id", userId).in("status", ACTIVE_PARTICIPANT_STATUSES);
  const ids = [...new Set((parts ?? []).map((p: { event_id: string }) => p.event_id))];
  if (ids.length === 0) return [];
  const { data } = await supabase
    .schema(schema).from("events").select("*")
    .in("id", ids).is("deleted_at", null)
    .order("event_start_at", { ascending: false });
  const rows = (data ?? []) as unknown as DecoratedEvent[];
  await decorateEvents(supabase, schema, rows);
  return rows;
}

/** お気に入りした募集（当種目）。 */
export async function fetchFavoriteEvents(
  supabase: Client,
  schema: string,
  userId: string,
): Promise<DecoratedEvent[]> {
  const { data: favRows } = await supabase
    .schema(SCHEMA.core).from("favorites").select("target_id")
    .eq("user_id", userId).eq("target_type", "recruitment").eq("domain", schema);
  const ids = (favRows ?? []).map((f: { target_id: string }) => f.target_id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .schema(schema).from("events").select("*")
    .in("id", ids).is("deleted_at", null)
    .order("event_start_at", { ascending: false });
  const rows = (data ?? []) as unknown as DecoratedEvent[];
  await decorateEvents(supabase, schema, rows);
  return rows;
}

export interface FollowUser {
  user_id: string;
  nickname: string | null;
  rating: number | null;
  avatar_url: string | null;
}

/**
 * フォロー（自分がフォローしている人）またはフォロワー（自分をフォローしている人）の一覧。
 * follows は RLS で follower_id/followee_id が自分の行のみ読めるためアプリ側で取得可能。
 */
export async function fetchFollows(
  supabase: Client,
  userId: string,
  direction: "following" | "followers",
): Promise<FollowUser[]> {
  const selfCol = direction === "following" ? "follower_id" : "followee_id";
  const otherCol = direction === "following" ? "followee_id" : "follower_id";
  const { data: rows } = await supabase
    .schema(SCHEMA.core).from("follows").select(`${otherCol}, created_at`)
    .eq(selfCol, userId)
    .order("created_at", { ascending: false });
  const ids = [...new Set((rows ?? []).map((r: Record<string, string>) => r[otherCol]))];
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .schema(SCHEMA.account).from("profiles")
    .select("user_id, nickname, rating, avatar_url").in("user_id", ids);
  const map = new Map(
    (profiles ?? []).map((p: FollowUser) => [p.user_id, p]),
  );
  // フォロー順（新しい順）を維持してプロフィールを並べる。
  return ids
    .map((id) => map.get(id))
    .filter((p): p is FollowUser => !!p);
}
