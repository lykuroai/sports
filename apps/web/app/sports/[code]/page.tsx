import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { EventCard } from "@spotomo/shared-ui";
import { PREFECTURES } from "@spotomo/shared-types";
import type { Facility } from "@spotomo/shared-types";
import { fetchEvents } from "../../../lib/events";
import { fetchSportNodes, resolveCategoryParent, resolveCategorySportIds } from "../../../lib/category";

// 種目別トップ（sport_category_page_design）。共通の施設DB・募集DBを種目で絞り込んで表示する。
// running は専用ページがあるためリダイレクト。golf/outdoor 含む他種目はこの汎用ページで提供。
const COPY: Record<string, { sub: string }> = {
  "cat-golf": { sub: "ラウンド仲間・練習仲間を探したり、ゴルフ場を選んで募集を作成できます。" },
  "cat-running": { sub: "ランニング・マラソン仲間を地域やレベルで探せます。" },
  "cat-outdoor": { sub: "キャンプ・登山・BBQ・釣りなど、自然を楽しむ仲間を探せます。" },
  "cat-ball": { sub: "サッカー・野球・テニス・バスケなどの参加者を探せます。" },
  "cat-fitness": { sub: "ジム・ヨガ・ダンス・トレーニング仲間を探せます。" },
  "cat-martial": { sub: "柔道・剣道・空手・ボクシングなどの仲間を探せます。" },
  "cat-water": { sub: "プール・SUP・カヤック・サーフィンなどの仲間を探せます。" },
  "cat-winter": { sub: "スキー・スノーボードなどの仲間を探せます。" },
  "cat-cycling": { sub: "サイクリング・ツーリング仲間を探せます。" },
  "cat-leisure": { sub: "ボウリング・ダーツ・ビリヤードなど気軽に遊べる仲間を探せます。" },
};

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createServerClient();
  const parent = resolveCategoryParent(await fetchSportNodes(supabase), code);
  const name = parent?.name ?? "種目";
  return { title: `${name}の仲間募集・施設検索`, description: `${name}の仲間募集を地域・レベルで探したり、施設を選んで募集を作成できます。` };
}

export default async function SportPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ pref?: string }>;
}) {
  const { code } = await params;
  if (code === "running") redirect("/running");
  const sp = await searchParams;
  const supabase = await createServerClient();

  const nodes = await fetchSportNodes(supabase);
  const parent = resolveCategoryParent(nodes, code);
  if (!parent) notFound();
  const sportIds = resolveCategorySportIds(nodes, code) ?? [];
  const children = nodes.filter((n) => n.parent_id === parent.id);
  const slug = parent.slug;

  // 新着募集（種目で絞り込み。現状 募集は running 種目が中心）と、種目に紐づくおすすめ施設。
  const [events, facRes] = await Promise.all([
    fetchEvents(supabase, { sportIds, prefecture: sp.pref, limit: 6 }),
    sportIds.length
      ? supabase.schema(SCHEMA.facility).from("facilities")
          .select("id, name, facility_type, prefecture, city, facility_sports!inner(sport_id)", { count: "exact" })
          .eq("status", "verified").in("facility_sports.sport_id", sportIds)
          .order("name", { ascending: true }).limit(6)
      : Promise.resolve({ data: [], count: 0 }),
  ]);
  const facilities = (facRes.data ?? []) as unknown as Facility[];
  const facCount = (facRes as { count?: number }).count ?? 0;
  const sportName = new Map(nodes.map((n) => [n.id, n.name]));

  const facHref = `/facilities?category=${slug}`;

  return (
    <div className="space-y-8">
      <nav className="text-sm text-slate-500"><Link href="/" className="hover:text-brand">ホーム</Link> ＞ {parent.name}</nav>

      {/* ヒーロー */}
      <section className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{parent.name}の仲間を見つけよう</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/90">{COPY[slug]?.sub ?? `${parent.name}の仲間募集・施設を探せます。`}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/recruitments?category=${slug}`} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">募集を探す</Link>
          <Link href={facHref} className="rounded-md border border-white/80 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">施設を探す</Link>
          <Link href={`/recruitments/new`} className="rounded-md border border-white/80 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">募集を作成</Link>
        </div>
      </section>

      {/* クイック導線（地域別） */}
      <form className="card flex flex-wrap items-end gap-2 p-4" action={`/recruitments`}>
        <input type="hidden" name="category" value={slug} />
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-slate-500">地域から{parent.name}の募集を探す</label>
          <select name="pref" defaultValue={sp.pref ?? ""} className="input max-w-[12rem]">
            <option value="">都道府県</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button className="btn-outline" type="submit">募集を探す</button>
      </form>

      {/* 新着募集 */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-bold">{parent.name}の新着募集</h2>
          <Link href={`/recruitments?category=${slug}`} className="text-sm text-brand hover:underline">もっと見る →</Link>
        </div>
        {events.length === 0 ? (
          <div className="card p-5 text-sm text-slate-600">
            この種目の募集はまだありません。
            <Link href={facHref} className="ml-1 text-brand hover:underline">施設を選んで最初の募集を作成</Link>できます。
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((r) => <EventCard key={r.id} event={r} sportLabel={sportName.get((r as { sport_id?: string }).sport_id ?? "") ?? parent.name} hrefBase="/recruitments" />)}
          </div>
        )}
      </section>

      {/* おすすめ施設 */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-bold">{parent.name}の施設（{facCount.toLocaleString("ja-JP")}件）</h2>
          <Link href={facHref} className="text-sm text-brand hover:underline">施設を探す →</Link>
        </div>
        {facilities.length === 0 ? (
          <p className="text-slate-500">この種目の施設は準備中です。</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facilities.map((f) => (
              <Link key={f.id} href={`/facilities/${f.id}`} className="card p-4 hover:shadow">
                <div className="font-medium">{f.name}</div>
                <div className="text-sm text-slate-500">{f.facility_type ? `${f.facility_type}・` : ""}{f.prefecture}{f.city}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 小カテゴリ */}
      {children.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">{parent.name}の種目</h2>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <Link key={c.id} href={`/recruitments?category=${slug}&q=${encodeURIComponent(c.name)}`} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200">{c.name}</Link>
            ))}
          </div>
        </section>
      )}

      {/* 人気地域（SEO・地域別導線。sport_category_page_design §16） */}
      <section>
        <h2 className="mb-3 text-xl font-bold">地域から探す</h2>
        <div className="flex flex-wrap gap-2">
          {["東京都", "神奈川県", "千葉県", "埼玉県", "愛知県", "大阪府", "兵庫県", "福岡県", "北海道"].map((pref) => (
            <Link key={pref} href={`/recruitments?category=${slug}&area=${encodeURIComponent(pref)}`} className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:border-brand hover:text-brand">
              {pref}の{parent.name}
            </Link>
          ))}
        </div>
      </section>

      {/* 説明 */}
      <section className="card p-5 text-sm leading-relaxed text-slate-700">
        <h2 className="mb-2 text-lg font-bold text-slate-900">{parent.name}の仲間募集について</h2>
        <p>
          {parent.name}ページでは、地域やレベルに合わせて一緒に楽しむ仲間を探せます。気になる募集に参加申請し、承認後はグループチャットで
          待ち合わせなどを調整しましょう。施設を選んで自分で募集を作成することもできます。連絡先は公開されないので安心です。
        </p>
      </section>
    </div>
  );
}
