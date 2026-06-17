"use client";

import { useActionState } from "react";
import { submitUserReview, type ReviewState } from "@/app/recruitments/[id]/review/actions";
import { USER_REVIEW_TAGS } from "@/lib/constants";

const initial: ReviewState = { error: null };

export function UserReviewForm({
  recruitmentId,
  targetUserId,
  targetName,
  existing,
}: {
  recruitmentId: string;
  targetUserId: string;
  targetName: string;
  existing?: { rating: number; review_tags: string[] | null; comment: string | null; visibility: string } | null;
}) {
  const [state, formAction, pending] = useActionState(submitUserReview, initial);
  const done = state.ok || !!existing;

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <input type="hidden" name="recruitment_id" value={recruitmentId} />
      <input type="hidden" name="target_user_id" value={targetUserId} />

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{targetName} さんを評価</h3>
        {done && <span className="badge bg-emerald-100 text-emerald-700">評価済み</span>}
      </div>

      <div>
        <span className="label">総合評価</span>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex cursor-pointer items-center gap-1 text-sm">
              <input
                type="radio"
                name="rating"
                value={n}
                defaultChecked={existing?.rating === n}
                required
              />
              {n}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className="label">良かった点（複数選択可）</span>
        <div className="flex flex-wrap gap-2">
          {USER_REVIEW_TAGS.map((tag) => (
            <label key={tag} className="badge cursor-pointer border border-slate-300 bg-white text-slate-600 has-[:checked]:border-brand has-[:checked]:bg-brand/10 has-[:checked]:text-brand">
              <input
                type="checkbox"
                name="review_tags"
                value={tag}
                defaultChecked={existing?.review_tags?.includes(tag)}
                className="mr-1"
              />
              {tag}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`comment-${targetUserId}`}>コメント（任意）</label>
        <textarea
          id={`comment-${targetUserId}`}
          name="comment"
          rows={2}
          className="input"
          defaultValue={existing?.comment ?? ""}
        />
        <p className="mt-1 text-xs text-slate-500">
          低評価のコメントは公開範囲が制限されます（公開情報は総合評価が中心）。
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="visibility"
          value="public"
          defaultChecked={existing?.visibility === "public"}
        />
        コメントを公開する
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "送信中..." : done ? "評価を更新する" : "評価を送信する"}
      </button>
    </form>
  );
}
