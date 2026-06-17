import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "./actions";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "グループチャット" };

// 仕様 §6.7: 募集ごとのグループチャット。承認済み参加者のみ。
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: recruitmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/chat/${recruitmentId}`);

  const { data: recruitment } = await supabase
    .from("recruitments")
    .select("id, title")
    .eq("id", recruitmentId)
    .maybeSingle();
  if (!recruitment) redirect("/recruitments");

  // メッセージ取得（RLS で非メンバーは空になる）
  const { data: room } = await supabase
    .from("chat_rooms")
    .select("id")
    .eq("recruitment_id", recruitmentId)
    .maybeSingle();

  const { data: messages } = room
    ? await supabase
        .from("chat_messages")
        .select("id, sender_id, message, created_at, profiles:sender_id ( display_name )")
        .eq("chat_room_id", room.id)
        .is("deleted_at", null)
        .order("created_at")
        .limit(200)
    : { data: null };

  // メンバーでない場合は RLS により room/messages が読めない
  const isMember = !!messages;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{recruitment.title}</h1>
        <Link href={`/recruitments/${recruitmentId}`} className="text-sm text-brand hover:underline">
          募集詳細へ
        </Link>
      </div>

      {!isMember ? (
        <p className="card p-8 text-center text-slate-500">
          このチャットは参加が承認されたメンバーのみ利用できます。
        </p>
      ) : (
        <>
          <div className="card max-h-[60vh] space-y-3 overflow-y-auto p-4">
            {messages!.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">まだメッセージはありません。</p>
            ) : (
              messages!.map((m) => {
                const mine = m.sender_id === user.id;
                // @ts-expect-error supabase join 形状
                const name = m.profiles?.display_name ?? "利用者";
                return (
                  <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <span className="text-xs text-slate-400">
                      {mine ? "自分" : name}・{formatDateTime(m.created_at)}
                    </span>
                    <p className={`mt-0.5 max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                      mine ? "bg-brand text-white" : "bg-slate-100 text-slate-800"
                    }`}>
                      {m.message}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <form action={sendMessage} className="flex gap-2">
            <input type="hidden" name="recruitment_id" value={recruitmentId} />
            <input name="message" className="input" placeholder="メッセージを入力" autoComplete="off" required />
            <button className="btn-primary shrink-0">送信</button>
          </form>
        </>
      )}
    </div>
  );
}
