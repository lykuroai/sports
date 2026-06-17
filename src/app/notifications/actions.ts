"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function user() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function markRead(formData: FormData): Promise<void> {
  const { supabase } = await user();
  const id = formData.get("notification_id") as string;
  // RLS: notifications_update（user_id = auth.uid()）
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/notifications");
}

export async function markAllRead(): Promise<void> {
  const { supabase, user: u } = await user();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", u.id)
    .is("read_at", null);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
