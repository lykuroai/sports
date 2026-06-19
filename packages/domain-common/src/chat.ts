import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient;

/**
 * グループチャットへメッセージ送信。RLS（種目スキーマの *_msg_insert）で
 * sender=auth.uid() かつ承認済みメンバーのみ通る。呼び出し側で user を検証すること。
 */
export async function sendChatMessage(
  supabase: Client,
  schema: string,
  opts: { roomId: string; userId: string; text: string },
): Promise<{ error: string | null }> {
  const text = opts.text.trim();
  if (!text) return { error: "メッセージが空です" };

  const { error } = await supabase
    .schema(schema)
    .from("chat_messages")
    .insert({ chat_room_id: opts.roomId, sender_id: opts.userId, message: text, message_type: "text" });

  return { error: error?.message ?? null };
}
