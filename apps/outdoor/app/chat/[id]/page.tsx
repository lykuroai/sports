import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import { sendChatMessage } from "@spotomo/domain-common";
import { ChatPanel, type ChatMessageView } from "@spotomo/shared-ui";

const SCHEMA = "outdoor";

// グループチャット（イベント単位）。承認済みメンバーのみ RLS で閲覧・送信可。
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/chat/${id}`);

  // RLS により非メンバーは room を読めない → notFound
  const { data: room } = await supabase
    .schema(SCHEMA).from("chat_rooms").select("id").eq("event_id", id).maybeSingle();
  if (!room) notFound();

  const { data: messages } = await supabase
    .schema(SCHEMA).from("chat_messages")
    .select("id, message, sender_id, created_at")
    .eq("chat_room_id", room.id)
    .order("created_at", { ascending: true })
    .limit(200);

  async function send(text: string): Promise<{ error: string | null }> {
    "use server";
    const s = await createServerClient();
    const {
      data: { user: u },
    } = await s.auth.getUser();
    if (!u) return { error: "ログインが必要です" };
    return sendChatMessage(s, SCHEMA, { roomId: room!.id, userId: u.id, text });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">グループチャット（アウトドア）</h1>
      <ChatPanel
        schema={SCHEMA}
        roomId={room.id}
        userId={user.id}
        initialMessages={(messages ?? []) as ChatMessageView[]}
        sendAction={send}
      />
      <p className="text-xs text-slate-400">承認済み参加者のみ閲覧・送信できます（RLS）。新着は Realtime で反映。</p>
    </div>
  );
}
