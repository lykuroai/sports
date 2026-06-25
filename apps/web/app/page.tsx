import Image from "next/image";
import Link from "next/link";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { EventCard } from "@spotomo/shared-ui";
import { fetchEvents } from "../lib/events";
import heroImage from "../public/park-hero.webp";

export const metadata = {
  title: "スポーツ・レジャーの仲間募集・施設検索サイト",
  description:
    "ゴルフ、ランニング、アウトドア、球技、フィットネスなど、スポーツ・レジャーの仲間募集を分類と地域から探せます。施設を選んで募集を作成することもできます。",
};

// 分類（top_page_design §10.4）。検索フォームの分類セレクトと種目カードに使う。
const CATEGORIES: { slug: string; name: string; icon: string; desc: string; href: string }[] = [
  { slug: "running", name: "ランニング", icon: "🏃", desc: "ランニング仲間・マラソン大会・競技場", href: "/sports/running" },
  { slug: "golf", name: "ゴルフ", icon: "⛳", desc: "ラウンド仲間・ゴルフ場・練習場", href: "/sports/golf" },
  { slug: "outdoor", name: "アウトドア", icon: "🏕️", desc: "キャンプ・登山・BBQ・釣り", href: "/sports/outdoor" },
  { slug: "ball-sports", name: "球技", icon: "⚽", desc: "サッカー・野球・テニス・バスケ", href: "/sports/ball-sports" },
  { slug: "fitness", name: "フィットネス", icon: "🧘", desc: "ジム・ヨガ・ダンス", href: "/sports/fitness" },
  { slug: "water-sports", name: "水泳・水辺", icon: "🏊", desc: "プール・SUP・カヤック", href: "/sports/water-sports" },
  { slug: "winter-sports", name: "ウィンター", icon: "🎿", desc: "スキー・スノーボード", href: "/sports/winter-sports" },
  { slug: "leisure", name: "レジャー", icon: "🎳", desc: "ボウリング・ダーツ・カラオケ", href: "/sports/leisure" },
  { slug: "all", name: "すべて", icon: "🔎", desc: "全カテゴリの施設を探す", href: "/facilities" },
];

// サービスの特徴（§15）。
const FEATURES: { title: string; body: string }[] = [
  { title: "募集を探せる", body: "分類と地域から、参加できる仲間募集を探せます。" },
  { title: "施設を選んで募集できる", body: "全国の施設DBから開催場所を選び、その施設で募集を作成できます。" },
  { title: "1つのサイトで横断", body: "ゴルフ・ランニング・アウトドアなど複数ジャンルを1アカウントで利用できます。" },
  { title: "連絡先は非公開で安心", body: "本名・電話・メールは公開されず、連絡は募集ごとのグループチャットで行います。" },
];

const FLOW_JOIN = ["「募集に参加する」を選ぶ", "分類・地域を選ぶ", "募集一覧から選ぶ", "参加申請する", "チャットで調整して当日参加"];
const FLOW_CREATE = ["「募集を作成する」を選ぶ", "分類・地域で施設を探す", "施設を選ぶ", "募集内容を入力", "募集を公開して参加者を待つ"];

export default async function HomePage() {
  const supabase = await createServerClient();
  const fac = supabase.schema(SCHEMA.facility);
  const run = supabase.schema(SCHEMA.running);

  const [events, facListRes, racesRes, facCntRes, raceCntRes, recCntRes, catRes] = await Promise.all([
    fetchEvents(supabase, {}),
    fac.from("facilities").select("id, name, facility_type, prefecture, city").eq("status", "verified").order("created_at", { ascending: false }).limit(6),
    run.from("races").select("id, name, prefecture, city, event_date, website_url").eq("discontinued", false).order("event_date", { ascending: true, nullsFirst: false }).limit(6),
    fac.from("facilities").select("id", { count: "exact", head: true }).eq("status", "verified"),
    run.from("races").select("id", { count: "exact", head: true }).eq("discontinued", false),
    run.from("events").select("id", { count: "exact", head: true }),
    supabase.schema(SCHEMA.core).from("sports").select("id, name", { count: "exact" }).eq("status", "published"),
  ]);

  const newRecruitments = events.slice(0, 6);
  // sport_id → 種目名（募集カードの種目バッジ）。
  const sportName = new Map(((catRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  const catCntRes = catRes;
  type Fac = { id: string; name: string; facility_type: string | null; prefecture: string | null; city: string | null };
  type Race = { id: string; name: string; prefecture: string | null; city: string | null; event_date: string | null; website_url: string | null };
  const facilities = (facListRes.data ?? []) as Fac[];
  const races = (racesRes.data ?? []) as Race[];

  const stats = [
    { label: "仲間募集", value: recCntRes.count ?? 0 },
    { label: "施設", value: facCntRes.count ?? 0 },
    { label: "大会・イベント", value: raceCntRes.count ?? 0 },
    { label: "カテゴリ", value: catCntRes.count ?? 0 },
  ];
  const nf = new Intl.NumberFormat("ja-JP");

  return (
    <div className="space-y-12">
      {/* 1. ヒーロー */}
      <section className="relative overflow-hidden">
        <Image src={heroImage} alt="スポーツ・レジャーの仲間を見つけよう" priority className="h-auto w-full" />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4 sm:p-8">
          <h1 className="text-3xl font-bold text-white drop-shadow sm:text-5xl">スポーツ・レジャーの仲間を見つけよう</h1>
          <p className="mt-3 max-w-3xl text-base font-medium text-white/95 drop-shadow sm:text-xl">
            募集を探す、または施設を選んで募集を作成できます。
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Link href="/recruitments" className="rounded-md bg-white px-5 py-2.5 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50">募集を探す</Link>
            <Link href="/facilities" className="rounded-md bg-emerald-600 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700">募集を作成する</Link>
          </div>
        </div>
      </section>

      {/* 統計情報（§19） */}
      <section className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl font-bold text-brand-dark sm:text-3xl">{nf.format(s.value)}</div>
            <div className="text-xs text-slate-500 sm:text-sm">{s.label}</div>
          </div>
        ))}
      </section>

      {/* カテゴリ一覧（§11） */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-slate-900">種目</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <a key={c.slug} href={c.href} className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-2xl">{c.icon}</span>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-slate-900">{c.name}</span>
                <span className="truncate text-xs text-slate-500">{c.desc}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* 4. 新着仲間募集（§12） */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-slate-900">新着の仲間募集</h2>
          <Link href="/recruitments" className="text-sm text-brand hover:underline">もっと見る →</Link>
        </div>
        {newRecruitments.length === 0 ? (
          <p className="text-slate-500">現在募集中の投稿はありません。最初の募集を作成してみましょう。</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {newRecruitments.map((r) => <EventCard key={r.id} event={r} sportLabel={sportName.get((r as { sport_id?: string }).sport_id ?? "") ?? "種目"} hrefBase="/recruitments" />)}
          </div>
        )}
      </section>

      {/* 5. おすすめ施設（§13） */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-slate-900">おすすめ施設</h2>
          <Link href="/facilities" className="text-sm text-brand hover:underline">施設を探す →</Link>
        </div>
        {facilities.length === 0 ? (
          <p className="text-slate-500">施設情報は準備中です。</p>
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

      {/* 6. イベント・大会情報（§14） */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-slate-900">イベント・大会情報</h2>
          <Link href="/events" className="text-sm text-brand hover:underline">大会を探す →</Link>
        </div>
        {races.length === 0 ? (
          <p className="text-slate-500">掲載中の大会情報は準備中です。</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {races.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-slate-500">{[r.prefecture, r.city].filter(Boolean).join("") || "開催地は公式情報を確認"}</div>
                {r.event_date && <div className="mt-0.5 text-sm font-medium text-brand">開催日 {r.event_date}</div>}
                <div className="mt-2 flex gap-3 text-sm">
                  {r.website_url && <a href={r.website_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">公式サイト ↗</a>}
                  <Link href={`/recruitments/new?race=${encodeURIComponent(r.name)}${r.prefecture ? `&pref=${encodeURIComponent(r.prefecture)}` : ""}`} className="text-slate-500 hover:underline">仲間を募集</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 7. サービスの特徴（§15） */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-slate-900">Spotomoでできること</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-4">
              <div className="mb-1 font-semibold text-emerald-700">{f.title}</div>
              <p className="text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 8. 利用の流れ（§16。参加する／作成する） */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-bold text-slate-900">募集に参加する</h2>
          <ol className="space-y-2">
            {FLOW_JOIN.map((step, i) => (
              <li key={i} className="flex items-center gap-3 rounded-md bg-white px-3 py-2 ring-1 ring-slate-100">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{i + 1}</span>
                <span className="text-sm text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="mb-3 text-xl font-bold text-slate-900">募集を作成する</h2>
          <ol className="space-y-2">
            {FLOW_CREATE.map((step, i) => (
              <li key={i} className="flex items-center gap-3 rounded-md bg-white px-3 py-2 ring-1 ring-slate-100">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">{i + 1}</span>
                <span className="text-sm text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
