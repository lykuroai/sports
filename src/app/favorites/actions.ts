"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TARGET_TYPES = ["recruitment", "facility", "sport", "organizer"] as const;

/** お気に入り／フォローの追加・解除トグル（仕様 §6.9） */
export async function toggleFavorite(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const targetType = formData.get("target_type") as (typeof TARGET_TYPES)[number];
  const targetId = formData.get("target_id") as string;
  const path = (formData.get("path") as string) || "/";
  if (!TARGET_TYPES.includes(targetType) || !targetId) return;

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  if (existing) {
    await supabase.from("favorites").delete().eq("id", existing.id);
  } else {
    await supabase
      .from("favorites")
      .insert({ user_id: user.id, target_type: targetType, target_id: targetId });
  }

  revalidatePath(path);
}
