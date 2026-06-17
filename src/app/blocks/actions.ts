"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** 利用者をブロック／解除（仕様 §6.11） */
export async function toggleBlock(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const blockedId = formData.get("blocked_user_id") as string;
  const path = (formData.get("path") as string) || "/mypage/blocks";
  if (!blockedId || blockedId === user.id) return;

  const { data: existing } = await supabase
    .from("blocks")
    .select("blocked_user_id")
    .eq("blocker_user_id", user.id)
    .eq("blocked_user_id", blockedId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("blocks")
      .delete()
      .eq("blocker_user_id", user.id)
      .eq("blocked_user_id", blockedId);
  } else {
    await supabase
      .from("blocks")
      .insert({ blocker_user_id: user.id, blocked_user_id: blockedId });
  }

  revalidatePath(path);
}
