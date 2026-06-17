import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FacilityReviewForm } from "@/components/facility-review-form";
import { FacilitySubmitForm } from "@/components/facility-submit-form";
import { FavoriteButton } from "@/components/favorite-button";
import { FACILITY_RATING_ASPECTS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: f } = await supabase
    .from("facilities")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!f) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let favFacility = false;
  if (user) {
    const { data: fav } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("target_type", "facility")
      .eq("target_id", id)
      .maybeSingle();
    favFacility = !!fav;
  }

  // この施設で開催予定の募集（仕様 §6.5: 施設起点で募集を探せる）
  const { data: relatedRecruitments } = await supabase
    .from("recruitments")
    .select("id, title, event_start_at")
    .eq("facility_id", id)
    .in("status", ["open", "few_left"])
    .order("event_start_at")
    .limit(5);

  // レビュー
  const { data: reviews } = await supabase
    .from("facility_reviews")
    .select("id, rating, equipment_rating, cleanliness_rating, access_rating, price_rating, comment, created_at, profiles:user_id ( display_name )")
    .eq("facility_id", id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);

  const avg =
    reviews && reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div>
          <Link href="/facilities" className="text-sm text-brand hover:underline">← 施設一覧</Link>
          <h1 className="mt-1 text-2xl font-bold">{f.name}</h1>
          {f.facility_type && <p className="text-sm text-slate-400">{f.facility_type}</p>}
          {avg !== null && (
            <p className="mt-1 text-sm">
              <span className="font-semibold text-amber-600">★ {avg.toFixed(1)}</span>{" "}
              <span className="text-slate-400">（{reviews!.length}件）</span>
            </p>
          )}
        </div>

        <section className="card divide-y divide-slate-100">
          {f.address && <Row label="住所" value={`${f.prefecture ?? ""}${f.city ?? ""}${f.address}`} />}
          {f.nearest_station && <Row label="最寄り駅" value={f.nearest_station} />}
          {f.access_description && <Row label="アクセス" value={f.access_description} />}
          {f.phone && <Row label="電話番号" value={f.phone} />}
          {f.website_url && <Row label="公式サイト" value={f.website_url} />}
          {f.price_description && <Row label="利用料金" value={f.price_description} />}
          {f.last_confirmed_at && <Row label="最終確認日" value={formatDateTime(f.last_confirmed_at)} />}
        </section>

        {user && (
          <details className="card p-4 text-sm">
            <summary className="cursor-pointer font-medium text-slate-600">
              情報が古い・誤っている場合は修正を申請
            </summary>
            <p className="mt-2 mb-3 text-xs text-slate-500">
              変更したい項目だけ入力してください。管理者または施設運営者の承認後に反映されます（仕様 §6.6）。
            </p>
            <FacilitySubmitForm
              mode="correction"
              facilityId={id}
              defaults={{
                name: f.name ?? undefined,
                prefecture: f.prefecture ?? undefined,
                city: f.city ?? undefined,
                address: f.address ?? undefined,
                nearest_station: f.nearest_station ?? undefined,
                phone: f.phone ?? undefined,
                website_url: f.website_url ?? undefined,
                price_description: f.price_description ?? undefined,
                facility_type: f.facility_type ?? undefined,
              }}
            />
          </details>
        )}

        <section>
          <h2 className="mb-3 text-lg font-bold">レビュー（{reviews?.length ?? 0}件）</h2>
          {(reviews ?? []).length === 0 ? (
            <p className="card p-6 text-sm text-slate-500">まだレビューはありません。</p>
          ) : (
            <ul className="space-y-3">
              {reviews!.map((rv) => (
                <li key={rv.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-600">★ {rv.rating}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(rv.created_at)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {FACILITY_RATING_ASPECTS.map((a) => {
                      const val = rv[a.key as keyof typeof rv] as number | null;
                      return val ? <span key={a.key}>{a.label}: {val}</span> : null;
                    })}
                  </div>
                  {rv.comment && <p className="mt-2 text-sm text-slate-700">{rv.comment}</p>}
                  <p className="mt-2 text-xs text-slate-400">
                    {/* @ts-expect-error supabase join 形状 */}
                    {rv.profiles?.display_name ?? "利用者"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {user ? (
          <FacilityReviewForm facilityId={id} />
        ) : (
          <p className="card p-4 text-sm text-slate-500">
            レビューの投稿には<Link href="/login" className="text-brand hover:underline">ログイン</Link>が必要です。
          </p>
        )}
      </div>

      <aside className="space-y-4">
        {user && (
          <FavoriteButton targetType="facility" targetId={id} active={favFacility} path={`/facilities/${id}`} />
        )}
        <div className="card p-5">
          <h2 className="mb-3 font-bold">この施設の募集</h2>
          {(relatedRecruitments ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">現在募集はありません。</p>
          ) : (
            <ul className="space-y-2">
              {relatedRecruitments!.map((r) => (
                <li key={r.id}>
                  <Link href={`/recruitments/${r.id}`} className="block rounded p-2 text-sm hover:bg-slate-50">
                    <span className="font-medium">{r.title}</span>
                    <span className="block text-xs text-slate-400">{formatDateTime(r.event_start_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/recruitments/new`} className="btn-outline mt-3 w-full">
            この施設で募集を作成
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-5 py-3 text-sm">
      <dt className="w-24 shrink-0 text-slate-400">{label}</dt>
      <dd className="break-all text-slate-700">{value}</dd>
    </div>
  );
}
