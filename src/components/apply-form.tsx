"use client";

import { useActionState } from "react";
import { applyToRecruitment, type FormState } from "@/app/recruitments/actions";

const initial: FormState = { error: null };

export function ApplyForm({ recruitmentId }: { recruitmentId: string }) {
  const [state, formAction, pending] = useActionState(applyToRecruitment, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="recruitment_id" value={recruitmentId} />
      <div>
        <label className="label" htmlFor="application_message">参加メッセージ（任意）</label>
        <textarea
          id="application_message"
          name="application_message"
          rows={3}
          className="input"
          placeholder="はじめまして。初心者ですがよろしくお願いします。"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "送信中..." : "この募集に参加申請する"}
      </button>
      <p className="text-xs text-slate-500">
        連絡先は主催者を含む他の利用者には公開されません。
      </p>
    </form>
  );
}
