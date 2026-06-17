"use client";

import { useActionState } from "react";
import { submitReport, type ReportState } from "@/app/reports/actions";
import { REPORT_REASONS } from "@/lib/constants";

const initial: ReportState = { error: null };

export function ReportForm({
  targetType,
  targetId,
}: {
  targetType: "recruitment" | "user" | "message" | "facility" | "review";
  targetId: string;
}) {
  const [state, formAction, pending] = useActionState(submitReport, initial);

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-slate-400 hover:text-slate-600">
        この内容を通報する
      </summary>
      <div className="mt-2">
        {state.ok ? (
          <p className="rounded bg-emerald-50 p-2 text-emerald-700">
            通報を受け付けました。運営が内容を確認します。
          </p>
        ) : (
          <form action={formAction} className="space-y-2">
            <input type="hidden" name="target_type" value={targetType} />
            <input type="hidden" name="target_id" value={targetId} />
            <select name="reason" className="input" required defaultValue="">
              <option value="" disabled>通報理由を選択</option>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <textarea name="description" rows={2} className="input" placeholder="詳細（任意）" />
            <input name="evidence_url" className="input" placeholder="証拠URL（任意）" />
            {state.error && <p className="text-xs text-red-600">{state.error}</p>}
            <button type="submit" className="btn-outline w-full text-red-600" disabled={pending}>
              {pending ? "送信中..." : "通報する"}
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
