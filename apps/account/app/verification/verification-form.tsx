"use client";

import { useActionState } from "react";
import { submitVerification, type VerificationState } from "./actions";

const initial: VerificationState = { error: null };

export function VerificationForm() {
  const [state, action, pending] = useActionState(submitVerification, initial);

  if (state.ok) {
    return (
      <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">
        本人確認書類を受け付けました。管理者の審査をお待ちください。
      </p>
    );
  }

  return (
    <form action={action} className="card space-y-3 p-6">
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      <div>
        <label className="label" htmlFor="document">本人確認書類（運転免許証・マイナンバーカード等）</label>
        <input id="document" name="document" type="file" accept="image/*" required className="text-sm" />
        <p className="mt-1 text-xs text-slate-400">
          画像は8MB以下。書類は管理者の審査のみに使用し、他の利用者には公開されません。
        </p>
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "送信中..." : "申請する"}
      </button>
    </form>
  );
}
