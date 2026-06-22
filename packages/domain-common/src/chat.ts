import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient;

export interface SentChatMessage {
  id: string;
  message: string | null;
  sender_id: string | null;
  created_at: string;
}

/**
 * グループチャットへメッセージ送信。RLS（種目スキーマの *_msg_insert）で
 * sender=auth.uid() かつ承認済みメンバーのみ通る。呼び出し側で user を検証すること。
 * 挿入したメッセージを返すので、送信側が Realtime を待たず即時に会話欄へ反映できる。
 */
export async function sendChatMessage(
  supabase: Client,
  schema: string,
  opts: { roomId: string; userId: string; text: string },
): Promise<{ error: string | null; message?: SentChatMessage }> {
  const text = opts.text.trim();
  if (!text) return { error: "メッセージが空です" };

  const { data, error } = await supabase
    .schema(schema)
    .from("chat_messages")
    .insert({ chat_room_id: opts.roomId, sender_id: opts.userId, message: text, message_type: "text" })
    .select("id, message, sender_id, created_at")
    .single();
  if (error) return { error: error.message };

  return { error: null, message: data as SentChatMessage };
}
