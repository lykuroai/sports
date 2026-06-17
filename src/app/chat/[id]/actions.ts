"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** 募集IDに紐づくグループチャットにメッセージを送信 */
export async function sendMessage(formData: FormData): Promise<void> {
  const recruitmentId = formData.get("recruitment_id") as string;
  const text = ((formData.get("message") as string) ?? "").trim();
  if (!text) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: room } = await supabase
    .from("chat_rooms")
    .select("id")
    .eq("recruitment_id", recruitmentId)
    .maybeSingle();
  if (!room) return;

  // RLS により承認済みメンバー以外の insert は拒否される
  await supabase.from("chat_messages").insert({
    chat_room_id: room.id,
    sender_id: user.id,
    message_type: "text",
    message: text,
  });

  revalidatePath(`/chat/${recruitmentId}`);
}
