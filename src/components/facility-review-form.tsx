"use client";

import { useActionState } from "react";
import {
  submitFacilityReview,
  type FacilityReviewState,
} from "@/app/facilities/[id]/actions";
import { FACILITY_RATING_ASPECTS } from "@/lib/constants";

const initial: FacilityReviewState = { error: null };

export function FacilityReviewForm({ facilityId }: { facilityId: string }) {
  const [state, formAction, pending] = useActionState(submitFacilityReview, initial);

  if (state.ok) {
    return (
      <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">
        レビューを投稿しました。ありがとうございました。
      </p>
    );
  }

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <input type="hidden" name="facility_id" value={facilityId} />
      <h3 className="font-semibold">この施設をレビュー</h3>

      <div>
        <span className="label">総合評価</span>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex cursor-pointer items-center gap-1 text-sm">
              <input type="radio" name="rating" value={n} required />
              {n}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FACILITY_RATING_ASPECTS.map((a) => (
          <div key={a.key}>
            <label className="label" htmlFor={a.key}>{a.label}</label>
            <select id={a.key} name={a.key} className="input" defaultValue="">
              <option value="">未評価</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="comment">コメント（任意）</label>
        <textarea id="comment" name="comment" rows={3} className="input" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "送信中..." : "レビューを投稿"}
      </button>
    </form>
  );
}
