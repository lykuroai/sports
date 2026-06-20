"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@spotomo/auth-client/client";
import { formatDateTime } from "@spotomo/shared-types";

export interface ChatMessageView {
  id: string;
  message: string | null;
  sender_id: string | null;
  created_at: string;
}

export interface ChatPanelProps {
  /** 種目スキーマ（'golf' | 'running' | 'outdoor'）。 */
  schema: string;
  roomId: string;
  userId: string;
  initialMessages: ChatMessageView[];
  /** 送信用 Server Action（呼び出し側でメンバー検証）。 */
  sendAction: (text: string) => Promise<{ error: string | null }>;
  /** 送信者ID→表示名のマップ（公開ニックネーム）。発言者名の表示に使う。 */
  memberNames?: Record<string, string>;
}

/**
 * グループチャット。初期メッセージをサーバから受け取り、Realtime で新着を購読する。
 * 送信は Server Action（RLS で承認済みメンバーのみ insert 可）。
 */
export function ChatPanel({
  schema,
  roomId,
  userId,
  initialMessages,
  sendAction,
  memberNames,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${schema}:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema, table: "chat_messages", filter: `chat_room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.new as ChatMessageView;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [schema, roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = inputRef.current?.value ?? "";
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await sendAction(text);
      if (res.error) setError(res.error);
      else if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="space-y-3">
      <div className="card max-h-[60vh] space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">まだメッセージはありません。</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userId;
            const name = mine
              ? "あなた"
              : (m.sender_id && memberNames?.[m.sender_id]) || "退出したメンバー";
            return (
              <div key={m.id} className={`text-sm ${mine ? "text-right" : ""}`}>
                <span className="text-xs font-medium text-slate-500">{name}</span>
                <span className="ml-2 text-xs text-slate-400">{formatDateTime(m.created_at)}</span>
                <p className={mine ? "text-brand-dark" : ""}>{m.message}</p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input ref={inputRef} className="input flex-1" placeholder="メッセージを入力" maxLength={2000} />
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "送信中" : "送信"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
