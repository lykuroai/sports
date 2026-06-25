"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";

// 通知の既読操作（本人のみ。RLS notif_self_update で user_id = auth.uid() が保証される）。
async function client() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage/notifications");
  return { supabase, userId: user.id };
}

export async function markNotificationRead(formData: FormData): Promise<void> {
  const { supabase, userId } = await client();
  const id = String(formData.get("id"));
  await supabase.schema(SCHEMA.core).from("notifications")
    .update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
  revalidatePath("/mypage/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  const { supabase, userId } = await client();
  await supabase.schema(SCHEMA.core).from("notifications")
    .update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  revalidatePath("/mypage/notifications");
}
