import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient, createAdminClient, SCHEMA, loginUrlFor } from "@spotomo/auth-client";
import { formatDateTime, OWNER_STATUS_LABEL } from "@spotomo/shared-types";
import type { Facility } from "@spotomo/shared-types";
import { submitFacilityReview } from "./review-actions";
import { applyForOwnership, withdrawOwnership } from "./owner-actions";

// 楽天GORA の予約リンクを楽天アフィリエイトのリダイレクト経由にして、確実に自分の
// アフィリエイトID（RAKUTEN_AFFILIATE_ID, サーバー env）を通す（送客→成果報酬）。
// 未設定時は素のGORA URL をそのまま使う（リンクは出すが無報酬）。
function goraAffiliateHref(targetUrl: string): string {
  const aff = process.env.RAKUTEN_AFFILIATE_ID;
  if (!aff) return targetUrl;
  const enc = encodeURIComponent(targetUrl);
  return `https://hb.afl.rakuten.co.jp/hgc/${aff}/?pc=${enc}&m=${enc}`;
}

export default async function FacilityDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: facility } = await supabase
    .schema(SCHEMA.facility)
    .from("facilities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!facility) notFound();
  const f = facility as Facility;

  // facility_sources は raw_data を含むため RLS で管理者のみ select 可（0031）。だが GORA の予約リンクや
  // OSM 帰属は公開情報なので、一般ユーザにも表示できるよう **安全な列のみ** をサービスロールで取得する。
  const admin = createAdminClient();
  const [{ data: featureRows }, { data: reviews }, { data: sourceRows }, { data: imageRows }] = await Promise.all([
    supabase.schema(SCHEMA.facility).from("facility_features").select("feature_key, value").eq("facility_id", id),
    supabase
      .schema(SCHEMA.facility)
      .from("facility_reviews")
      .select("id, user_id, rating, comment, created_at")
      .eq("facility_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin.schema(SCHEMA.facility).from("facility_sources").select("source_type, source_url, source_name, license").eq("facility_id", id),
    supabase.schema(SCHEMA.facility).from("facility_images").select("url, display_order").eq("facility_id", id).order("display_order", { ascending: true }),
  ]);

  const images = ((imageRows ?? []) as { url: string; display_order: number }[]).filter((i) => i.url);

  type Source = { source_type: string; source_url: string | null; source_name: string | null; license: string | null };
  const sources = (sourceRows ?? []) as Source[];
  // 楽天GORA の予約導線（送客モデル）。予約・決済は楽天GORA 側で確定する。
  const gora = sources.find((s) => s.source_type === "rakuten_gora" && s.source_url);
  // 出所の帰属表示（OSM は ODbL 帰属が必須）。
  const hasOsm = sources.some((s) => s.source_type === "openstreetmap");
  const attribution = sources
    .map((s) => (s.source_type === "openstreetmap" ? "© OpenStreetMap contributors" : s.source_type === "rakuten_gora" ? "楽天GORA" : s.source_name))
    .filter((v, i, a) => v && a.indexOf(v) === i);

  type Review = { id: string; user_id: string; rating: number; comment: string | null; created_at: string };
  const reviewList = (reviews ?? []) as Review[];
  const reviewerIds = [...new Set(reviewList.map((r) => r.user_id))];
  const { data: profiles } = reviewerIds.length
    ? await supabase.schema(SCHEMA.account).from("profiles").select("user_id, nickname").in("user_id", reviewerIds)
    : { data: [] as { user_id: string; nickname: string }[] };
  const nameMap = new Map((profiles ?? []).map((p: { user_id: string; nickname: string }) => [p.user_id, p.nickname]));
  const avg = reviewList.length ? reviewList.reduce((s, r) => s + r.rating, 0) / reviewList.length : 0;

  // ログインユーザの当該施設に対する運営者ステータス（申請/承認状況の出し分けに使う）。
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

  const mapHref =
    f.latitude != null && f.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${f.latitude},${f.longitude}`
      : null;

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link href="/facilities" className="text-sm text-brand hover:underline">← 施設を探す</Link>

      <header>
        <h1 className="text-2xl font-bold">{f.name}</h1>
        <p className="text-sm text-slate-500">
          {f.facility_type ? `${f.facility_type}・` : ""}{f.prefecture}{f.city}{f.address}
        </p>
        {reviewList.length > 0 && (
          <p className="mt-1 text-sm">評価 {avg.toFixed(1)}（{reviewList.length}件）</p>
        )}
      </header>

      {images.length > 0 && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0].url} alt={f.name} className="h-64 w-full rounded-lg border border-slate-200 object-cover" />
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {images.slice(1).map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.url} src={img.url} alt={f.name} className="h-20 w-full rounded-md border border-slate-200 object-cover" />
              ))}
            </div>
          )}
        </div>
      )}

      {f.description && (
        <section className="space-y-1">
          <h2 className="font-semibold">概要</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{f.description}</p>
        </section>
      )}

      {(featureRows ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(featureRows as { feature_key: string; value: string | null }[]).map((ft) => (
            <span key={ft.feature_key} className="badge bg-slate-100 text-slate-600">
              {ft.feature_key}{ft.value ? `: ${ft.value}` : ""}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/recruitments/new?facility=${f.id}`} className="btn-primary">この施設で募集を作成</Link>
        {gora?.source_url && (
          <a href={goraAffiliateHref(gora.source_url)} target="_blank" rel="noopener noreferrer sponsored" className="btn-outline border-rose-400 text-rose-600 hover:bg-rose-50">楽天GORAで予約する ↗</a>
        )}
        {mapHref && (
          <a href={mapHref} target="_blank" rel="noopener noreferrer" className="btn-outline">地図で見る</a>
        )}
      </div>
      {gora && (
        <p className="text-xs text-slate-400">
          料金・空き状況は変動します。予約は楽天GORA のページで確定します（送客）。
        </p>
      )}

      {/* 地図（OpenStreetMap 埋め込み・APIキー不要） */}
      {f.latitude != null && f.longitude != null && (
        <iframe
          title="地図"
          className="h-64 w-full rounded-lg border border-slate-200"
          loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${f.longitude - 0.01}%2C${f.latitude - 0.01}%2C${f.longitude + 0.01}%2C${f.latitude + 0.01}&layer=mapnik&marker=${f.latitude}%2C${f.longitude}`}
        />
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
        {user ? (
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
        ) : (
          <p className="text-sm text-slate-500">
            レビューを投稿するには<Link href={await loginUrlFor(`/facilities/${f.id}`)} className="text-brand hover:underline">ログイン</Link>してください。
          </p>
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

      {attribution.length > 0 && (
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
          出所: {attribution.join(" / ")}
          {hasOsm && "（地図データは OpenStreetMap の貢献者によるもので ODbL ライセンスで提供されています）"}
        </p>
      )}
    </article>
  );
}
