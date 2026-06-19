import { notFound } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import { formatDateTime } from "@spotomo/shared-types";

// グループチャット（イベント単位）。承認済みメンバーのみ RLS で閲覧可。
// MVP は閲覧 + 送信の最小実装。Realtime 購読は今後追加。
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: room } = await supabase
    .schema("golf").from("chat_rooms").select("id").eq("event_id", id).maybeSingle();
  if (!room) notFound();

  const { data: messages } = await supabase
    .schema("golf").from("chat_messages")
    .select("id, message, sender_id, created_at")
    .eq("chat_room_id", room.id)
    .order("created_at", { ascending: true })
    .limit(200);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">グループチャット</h1>
      <div className="card space-y-2 p-4">
        {(messages ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">まだメッセージはありません。</p>
        ) : (
          (messages as { id: string; message: string | null; created_at: string }[]).map((m) => (
            <div key={m.id} className="text-sm">
              <span className="text-slate-400">{formatDateTime(m.created_at)}</span>
              <p>{m.message}</p>
            </div>
          ))
        )}
      </div>
      <p className="text-xs text-slate-400">
        ※ 承認済み参加者のみ閲覧できます（RLS）。送信フォーム・Realtime 購読は今後実装。
      </p>
    </div>
  );
}
