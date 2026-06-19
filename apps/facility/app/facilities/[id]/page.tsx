import { notFound } from "next/navigation";
import { createServerClient, getUser, SCHEMA } from "@spotomo/auth-client";
import { formatDateTime } from "@spotomo/shared-types";
import type { Facility } from "@spotomo/shared-types";
import { submitFacilityReview } from "./review-actions";

export default async function FacilityDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: facility } = await supabase
    .schema(SCHEMA.facility)
    .from("facilities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!facility) notFound();
  const f = facility as Facility;

  const [{ data: featureRows }, { data: reviews }] = await Promise.all([
    supabase.schema(SCHEMA.facility).from("facility_features").select("feature_key, value").eq("facility_id", id),
    supabase.schema(SCHEMA.facility).from("facility_reviews").select("id, user_id, rating, comment, created_at").eq("facility_id", id).order("created_at", { ascending: false }).limit(50),
  ]);

  type Review = { id: string; user_id: string; rating: number; comment: string | null; created_at: string };
  const reviewList = (reviews ?? []) as Review[];
  const reviewerIds = [...new Set(reviewList.map((r) => r.user_id))];
  const { data: profiles } = reviewerIds.length
    ? await supabase.schema(SCHEMA.account).from("profiles").select("user_id, nickname").in("user_id", reviewerIds)
    : { data: [] as { user_id: string; nickname: string }[] };
  const nameMap = new Map((profiles ?? []).map((p: { user_id: string; nickname: string }) => [p.user_id, p.nickname]));
  const avg = reviewList.length ? reviewList.reduce((s, r) => s + r.rating, 0) / reviewList.length : 0;

  const user = await getUser();

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{f.name}</h1>
        <p className="text-sm text-slate-500">
          {f.facility_type ? `${f.facility_type}・` : ""}{f.prefecture}{f.city}{f.address}
        </p>
        {reviewList.length > 0 && (
          <p className="mt-1 text-sm">評価 {avg.toFixed(1)}（{reviewList.length}件）</p>
        )}
      </header>

      {f.description && <p className="whitespace-pre-wrap text-sm text-slate-700">{f.description}</p>}

      {(featureRows ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(featureRows as { feature_key: string; value: string | null }[]).map((ft) => (
            <span key={ft.feature_key} className="badge bg-slate-100 text-slate-600">
              {ft.feature_key}{ft.value ? `: ${ft.value}` : ""}
            </span>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">レビュー</h2>
        {user && (
          <form action={submitFacilityReview} className="card space-y-2 p-4">
            <input type="hidden" name="facility_id" value={f.id} />
            <div>
              <label className="label" htmlFor="rating">評価</label>
              <select id="rating" name="rating" className="input max-w-[8rem]" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <textarea name="comment" className="input" rows={2} placeholder="コメント（任意）" />
            <button className="btn-primary" type="submit">レビューを投稿</button>
          </form>
        )}

        {reviewList.length === 0 ? (
          <p className="text-sm text-slate-400">まだレビューはありません。</p>
        ) : (
          <ul className="card divide-y">
            {reviewList.map((r) => (
              <li key={r.id} className="p-4 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{nameMap.get(r.user_id) ?? "利用者"}</span>
                  <span className="text-slate-400">★{r.rating}・{formatDateTime(r.created_at)}</span>
                </div>
                {r.comment && <p className="mt-1 text-slate-600">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
