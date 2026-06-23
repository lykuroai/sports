"use client";

import { useActionState } from "react";
import { updateNotificationSettings, type NotifySettingsState } from "./actions";

const initial: NotifySettingsState = { error: null };

export function NotificationSettingsForm({ emailEnabled }: { emailEnabled: boolean }) {
  const [state, action, pending] = useActionState(updateNotificationSettings, initial);

  return (
    <form action={action} className="card space-y-4 p-6">
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded bg-green-50 p-2 text-sm text-green-700">保存しました</p>}

      <label className="flex items-start gap-3">
        <input type="checkbox" name="email_enabled" defaultChecked={emailEnabled} className="mt-1" />
        <span>
          <span className="font-medium">メール通知を受け取る</span>
          <span className="block text-xs text-slate-500">
            参加申請・承認・主催者からのメッセージなどをメールでお知らせします。
            オフにしてもアプリ内の通知は届きます。
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 opacity-60">
        <input type="checkbox" disabled className="mt-1" />
        <span>
          <span className="font-medium">プッシュ通知を受け取る</span>
          <span className="block text-xs text-slate-500">（現在準備中）</span>
        </span>
      </label>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "保存中..." : "保存"}
      </button>
    </form>
  );
}
