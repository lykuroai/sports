"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import { toggleFavorite, toggleFollow } from "@spotomo/domain-common";

const SCHEMA = "outdoor";

export async function toggleFavoriteAction(eventId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return toggleFavorite(supabase, { userId: user.id, targetType: "recruitment", targetId: eventId, domain: SCHEMA });
}

export async function toggleFollowAction(organizerId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return toggleFollow(supabase, { followerId: user.id, followeeId: organizerId });
}
