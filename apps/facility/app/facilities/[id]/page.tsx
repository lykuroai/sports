import { notFound } from "next/navigation";
import { createServerClient, getUser, SCHEMA } from "@spotomo/auth-client";
import { formatDateTime, OWNER_STATUS_LABEL } from "@spotomo/shared-types";
import type { Facility } from "@spotomo/shared-types";
import { submitFacilityReview } from "./review-actions";
import { applyForOwnership, withdrawOwnership } from "./owner-actions";

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

  const { data: ownership } = user
    ? await supabase
        .schema(SCHEMA.facility)
        .from("facility_owners")
        .select("status")
        .eq("facility_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const ownerStatus = (ownership as { status: string } | null)?.status ?? null;

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

      {user && (
        <section className="card space-y-2 p-4">
          <h2 className="font-semibold">この施設の運営者ですか？</h2>
          {ownerStatus === "verified" ? (
            <p className="text-sm text-emerald-700">あなたはこの施設の承認済み運営者です。施設情報を編集できます。</p>
          ) : ownerStatus === "pending" ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">運営者申請は{OWNER_STATUS_LABEL.pending}です。管理者の承認をお待ちください。</p>
              <form action={withdrawOwnership}>
                <input type="hidden" name="facility_id" value={f.id} />
                <button className="btn-outline" type="submit">申請を取り下げる</button>
              </form>
            </div>
          ) : ownerStatus === "rejected" || ownerStatus === "revoked" ? (
            <p className="text-sm text-slate-500">運営者申請は{OWNER_STATUS_LABEL[ownerStatus]}されています。再申請は運営にお問い合わせください。</p>
          ) : (
            <form action={applyForOwnership} className="space-y-2">
              <input type="hidden" name="facility_id" value={f.id} />
              <p className="text-sm text-slate-600">
                施設の公式運営者として情報を管理できます。本人性・施設との関係を確認するため、根拠URL（公式サイト等）の入力にご協力ください。
              </p>
              <div>
                <label className="label" htmlFor="evidence_url">根拠URL（任意）</label>
                <input id="evidence_url" name="evidence_url" type="url" className="input" placeholder="https://example.com/about" />
              </div>
              <textarea name="note" className="input" rows={2} placeholder="補足（任意：役職・連絡可能なことなど）" />
              <button className="btn-primary" type="submit">運営者として申請する</button>
            </form>
          )}
        </section>
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
