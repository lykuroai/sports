import Image from "next/image";
import Link from "next/link";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { EventCard } from "@spotomo/shared-ui";
import { fetchEvents, countRecruitmentsByPrefecture } from "../../lib/events";
import { fetchSportNodes, resolveCategorySportIds } from "../../lib/category";
import heroImage from "../../public/running-hero.svg";
import timeboxImage from "../../public/timebox-race.png";

export const metadata = {
  title: "ランニング仲間募集・ランニング施設検索",
  description:
    "ランニング仲間を地域・日時・レベルで探せるSpotomo。初心者歓迎のジョギング、マラソン練習会、ランニングコースや施設情報もまとめて検索できます。",
};

// クイック導線（sport_category_page_design §10）。
const QUICK = [
  { label: "募集を探す", href: "/running" },
  { label: "大会を探す", href: "/events" },
  { label: "施設を探す", href: "/facilities?category=running" },
  { label: "募集を作成", href: "/recruitments/new" },
];

// 小カテゴリ（§14.1）。MVP は募集検索のキーワードへ。
const SUBCATS = ["マラソン", "ジョギング", "駅伝", "陸上競技", "ランニングコース", "陸上競技場"];

export default async function RunningTop({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pref?: string; beginner?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();

  // ランニング種目（大分類＋小分類）の sport_id 群に絞り込む。
  const nodes = await fetchSportNodes(supabase);
  const runningIds = resolveCategorySportIds(nodes, "running") ?? [];

  // 新着募集（ランニング種目に限定）と、ランニングに紐づくおすすめ施設（共通DB・確認済み）。
  type Fac = { id: string; name: string; facility_type: string | null; prefecture: string | null; city: string | null };
  const [events, facRes] = await Promise.all([
    fetchEvents(supabase, { keyword: sp.q, prefecture: sp.pref, beginnerOnly: sp.beginner === "1", sportIds: runningIds }),
    runningIds.length
      ? supabase.schema(SCHEMA.facility).from("facilities")
          .select("id, name, facility_type, prefecture, city, facility_sports!inner(sport_id)")
          .eq("status", "verified").in("facility_sports.sport_id", runningIds)
          .order("name", { ascending: true }).limit(6)
      : Promise.resolve({ data: [] }),
  ]);
  const facilities = (facRes.data ?? []) as unknown as Fac[];

  // 都道府県ごとの募集件数（「地域から探す」の件数表示）。
  const prefCounts = await countRecruitmentsByPrefecture(supabase, runningIds);

  return (
    <div className="space-y-8">
      {/* パンくず */}
      <nav className="text-sm text-slate-500"><Link href="/" className="hover:text-brand">ホーム</Link> ＞ ランニング</nav>

      {/* ヒーロー */}
      <section className="relative overflow-hidden rounded-2xl">
        <Image src={heroImage} alt="一緒に走る仲間を見つけよう" priority className="h-auto w-full" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/60 to-transparent p-4 sm:p-6">
          <h1 className="text-2xl font-bold text-white drop-shadow sm:text-3xl">一緒に走る仲間を見つけよう</h1>
          <p className="max-w-2xl text-sm text-white/90 sm:text-base">ランニング、マラソン、ジョギング仲間を地域やレベルで探せます。</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Link href="/events" className="rounded-md bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">大会を探す</Link>
            <Link href="/facilities?category=running" className="rounded-md border border-white/80 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">施設を探す</Link>
            <Link href="/recruitments/new" className="rounded-md border border-white/80 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">募集を作成</Link>
          </div>
        </div>
      </section>

      {/* クイック導線 */}
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <Link key={q.label} href={q.href} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:border-brand hover:text-brand">{q.label}</Link>
        ))}
      </div>

      {/* 種目内検索 */}
      <form className="card flex flex-wrap gap-2 p-4" action="/running">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="キーワード" className="input max-w-xs" />
        <input name="pref" defaultValue={sp.pref ?? ""} placeholder="都道府県" className="input max-w-[10rem]" />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="beginner" value="1" defaultChecked={sp.beginner === "1"} />
          初心者歓迎のみ
        </label>
        <button className="btn-outline" type="submit">検索</button>
      </form>

      {/* 新着募集 */}
      <section>
        <h2 className="mb-3 text-xl font-bold">ランニングの新着募集</h2>
        {events.length === 0 ? (
          <p className="text-slate-500">条件に合う募集がありません。</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.slice(0, 8).map((r) => <EventCard key={r.id} event={r} sportLabel="ランニング" hrefBase="/recruitments" />)}
          </div>
        )}
      </section>

      {/* 宣伝枠：計測システム timebox-race（外部） */}
      <section>
        <a
          href="https://timebox.ebskk.com/LP/timebox-race/index.html"
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="group flex flex-col gap-4 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-sky-50 p-5 transition hover:shadow-md sm:flex-row sm:items-center"
        >
          {/* 計測装置（RFID 計測機とアンテナ）のイメージ */}
          <Image
            src={timeboxImage}
            alt="TIMEBOX RACE の RFID 計測機とアンテナ"
            className="h-auto w-full rounded-lg border border-emerald-100 bg-white object-cover sm:w-48"
            sizes="(max-width: 640px) 100vw, 12rem"
          />
          <div className="flex flex-1 flex-col gap-1">
            <span className="inline-flex w-fit items-center rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">PR・計測システム</span>
            <h2 className="text-lg font-bold text-slate-900">大会・練習会の記録は「TIMEBOX RACE」で</h2>
            <p className="text-sm text-slate-600">
              ランニング大会やイベントのタイム計測をかんたんに。練習会の記録管理にもおすすめの計測システムです。
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition group-hover:bg-emerald-700 sm:self-center">
            詳しく見る →
          </span>
        </a>
      </section>

      {/* おすすめ施設（ランニング紐付け） */}
      {facilities.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-xl font-bold">ランニングにおすすめの施設</h2>
            <Link href="/facilities?category=running" className="text-sm text-brand hover:underline">もっと見る →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facilities.map((f) => (
              <Link key={f.id} href={`/facilities/${f.id}`} className="card p-4 hover:shadow">
                <div className="font-medium">{f.name}</div>
                <div className="text-sm text-slate-500">{f.facility_type ? `${f.facility_type}・` : ""}{f.prefecture}{f.city}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 小カテゴリ */}
      <section>
        <h2 className="mb-3 text-xl font-bold">もっと絞り込む</h2>
        <div className="flex flex-wrap gap-2">
          {SUBCATS.map((s) => (
            <Link key={s} href={`/running?q=${encodeURIComponent(s)}`} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200">{s}</Link>
          ))}
        </div>
      </section>

      {/* 人気地域（§16） */}
      <section>
        <h2 className="mb-3 text-xl font-bold">地域から探す</h2>
        <div className="flex flex-wrap gap-2">
          {["東京都", "神奈川県", "千葉県", "埼玉県", "愛知県", "大阪府", "兵庫県", "福岡県", "北海道"].map((pref) => (
            <Link key={pref} href={`/recruitments?category=running&area=${encodeURIComponent(pref)}`} className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:border-brand hover:text-brand">
              {pref}のランニング
              <span className="ml-1 text-xs text-slate-400">({prefCounts.get(pref) ?? 0})</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 初心者向け説明（§15） */}
      <section className="card p-5 text-sm leading-relaxed text-slate-700">
        <h2 className="mb-2 text-lg font-bold text-slate-900">ランニング仲間募集について</h2>
        <p>
          ランニングページでは、地域や日時、レベルに合わせて一緒に走る仲間を探せます。初心者歓迎のジョギング、週末の練習会、
          マラソン大会に向けた練習仲間など、目的に合わせて参加できます。気になる募集に参加申請し、承認後はグループチャットで
          待ち合わせなどを調整しましょう。連絡先は公開されないので安心です。
        </p>
      </section>
    </div>
  );
}
