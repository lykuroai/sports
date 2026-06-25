import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { formatDateTime } from "@spotomo/shared-types";
import type { Facility } from "@spotomo/shared-types";

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

  const [{ data: featureRows }, { data: reviews }, { data: sourceRows }, { data: imageRows }] = await Promise.all([
    supabase.schema(SCHEMA.facility).from("facility_features").select("feature_key, value").eq("facility_id", id),
    supabase
      .schema(SCHEMA.facility)
      .from("facility_reviews")
      .select("id, user_id, rating, comment, created_at")
      .eq("facility_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.schema(SCHEMA.facility).from("facility_sources").select("source_type, source_url, source_name, license").eq("facility_id", id),
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
          <a href={gora.source_url} target="_blank" rel="noopener noreferrer" className="btn-outline border-rose-400 text-rose-600 hover:bg-rose-50">楽天GORAで予約する ↗</a>
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

      <section className="space-y-3">
        <h2 className="font-semibold">レビュー</h2>
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
