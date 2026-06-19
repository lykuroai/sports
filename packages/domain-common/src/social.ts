import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA } from "@spotomo/auth-client";
import { notifyUser } from "./notify";

type Client = SupabaseClient;

export type FavoriteTarget = "recruitment" | "facility" | "sport" | "area" | "organizer";

/** お気に入りのトグル。戻り値は操作後に登録されているか。 */
export async function toggleFavorite(
  supabase: Client,
  opts: { userId: string; targetType: FavoriteTarget; targetId: string; domain?: string },
): Promise<boolean> {
  const { userId, targetType, targetId, domain } = opts;
  const { data: existing } = await supabase
    .schema(SCHEMA.core)
    .from("favorites")
    .select("target_id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  if (existing) {
    await supabase
      .schema(SCHEMA.core)
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("target_type", targetType)
      .eq("target_id", targetId);
    return false;
  }
  await supabase
    .schema(SCHEMA.core)
    .from("favorites")
    .insert({ user_id: userId, target_type: targetType, target_id: targetId, domain: domain ?? null });
  return true;
}

export async function isFavorited(
  supabase: Client,
  opts: { userId: string; targetType: FavoriteTarget; targetId: string },
): Promise<boolean> {
  const { data } = await supabase
    .schema(SCHEMA.core)
    .from("favorites")
    .select("target_id")
    .eq("user_id", opts.userId)
    .eq("target_type", opts.targetType)
    .eq("target_id", opts.targetId)
    .maybeSingle();
  return !!data;
}

/** 主催者フォローのトグル。新規フォロー時は相手へ通知。 */
export async function toggleFollow(
  supabase: Client,
  opts: { followerId: string; followeeId: string },
): Promise<boolean> {
  const { followerId, followeeId } = opts;
  if (followerId === followeeId) return false;

  const { data: existing } = await supabase
    .schema(SCHEMA.core)
    .from("follows")
    .select("followee_id")
    .eq("follower_id", followerId)
    .eq("followee_id", followeeId)
    .maybeSingle();

  if (existing) {
    await supabase
      .schema(SCHEMA.core)
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("followee_id", followeeId);
    return false;
  }
  await supabase
    .schema(SCHEMA.core)
    .from("follows")
    .insert({ follower_id: followerId, followee_id: followeeId });
  await notifyUser({
    userId: followeeId,
    type: "follow",
    title: "新しいフォロワーがいます",
    relatedType: "user",
    relatedId: followerId,
  });
  return true;
}

export async function isFollowing(
  supabase: Client,
  opts: { followerId: string; followeeId: string },
): Promise<boolean> {
  const { data } = await supabase
    .schema(SCHEMA.core)
    .from("follows")
    .select("followee_id")
    .eq("follower_id", opts.followerId)
    .eq("followee_id", opts.followeeId)
    .maybeSingle();
  return !!data;
}

/** ブロックの設定/解除。 */
export async function setBlock(
  supabase: Client,
  opts: { blockerId: string; blockedId: string; block: boolean },
): Promise<void> {
  const { blockerId, blockedId, block } = opts;
  if (blockerId === blockedId) return;
  if (block) {
    await supabase
      .schema(SCHEMA.core)
      .from("blocks")
      .upsert({ blocker_id: blockerId, blocked_id: blockedId });
  } else {
    await supabase
      .schema(SCHEMA.core)
      .from("blocks")
      .delete()
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blockedId);
  }
}
