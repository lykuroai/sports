import { redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import { fetchReviewTargets } from "@spotomo/domain-common";
import { USER_REVIEW_TAGS } from "@spotomo/shared-types";
import { submitReviewAction } from "./actions";

const SCHEMA = "running";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/events/${id}/review`);

  const targets = await fetchReviewTargets(supabase, SCHEMA, id, user.id);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">相互評価（ランニング）</h1>
      <p className="text-sm text-slate-500">
        開催後に、一緒に活動したメンバーを評価できます。個別の低評価コメントは公開範囲を制限し、
        公開されるのは総合評価・参加回数・主催回数のみです。
      </p>
      {targets.length === 0 ? (
        <p className="text-slate-500">評価できるメンバーがいません（承認済みメンバーかつ開催後）。</p>
      ) : (
        targets.map((t) => (
          <form key={t.user_id} action={submitReviewAction} className="card space-y-3 p-4">
            <input type="hidden" name="event_id" value={id} />
            <input type="hidden" name="reviewee_id" value={t.user_id} />
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.nickname ?? "メンバー"}</span>
              {t.already_reviewed && <span className="badge bg-green-100 text-green-700">評価済み</span>}
            </div>
            <div>
              <label className="label">総合評価</label>
              <select name="rating" className="input max-w-[8rem]" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {USER_REVIEW_TAGS.map((tag) => (
                <label key={tag} className="flex items-center gap-1">
                  <input type="checkbox" name="tags" value={tag} /> {tag}
                </label>
              ))}
            </div>
            <textarea name="comment" className="input" rows={2} placeholder="コメント（任意・公開範囲制限）" />
            <button className="btn-primary" type="submit">{t.already_reviewed ? "更新する" : "評価する"}</button>
          </form>
        ))
      )}
    </div>
  );
}
