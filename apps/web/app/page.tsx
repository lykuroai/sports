import Image from "next/image";
import Link from "next/link";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { EventCard } from "@spotomo/shared-ui";
import { PREFECTURES } from "@spotomo/shared-types";
import { fetchEvents } from "../lib/events";
import heroImage from "../public/park-hero.webp";

export const metadata = {
  title: "スポーツ・レジャーの仲間募集・施設検索サイト",
  description:
    "ゴルフ、ランニング、アウトドア、球技、フィットネスなど、スポーツ・レジャーの仲間募集、施設検索、イベント情報を1つのサイトで探せます。",
};

// 種目カード（種目から探す）。running は統合サイト内パス、golf/outdoor は移行期は
// 既存サブドメインへ。施設は共通DBなので「すべての施設」は /facilities へ。
const SPORT_CARDS: { slug: string; label: string; desc: string; logo: string; href: string }[] = [
  { slug: "running", label: "ランニング", desc: "ランニング仲間・マラソン大会・競技場", logo: "/running-logo.svg", href: "/running" },
  { slug: "golf", label: "ゴルフ", desc: "ラウンド仲間・ゴルフ場・練習場", logo: "/golf-logo.svg", href: "//golf-spotomo.lykuro.ai" },
  { slug: "outdoor", label: "アウトドア", desc: "キャンプ・登山・BBQ・釣り", logo: "/outdoor-logo.svg", href: "//outdoor-spotomo.lykuro.ai" },
];

// サービスの特徴（top_page_design §15）。
const FEATURES: { title: string; body: string }[] = [
  { title: "1つのサイトで探せる", body: "複数ジャンルのスポーツ・レジャーを横断して、仲間募集・施設・イベントを探せます。" },
  { title: "施設と募集を紐づけ", body: "募集場所となる施設情報を一緒に確認でき、活動場所がすぐ見つかります。" },
  { title: "カテゴリ別に探しやすい", body: "ゴルフ・ランニング・アウトドアなど種目別に整理。目的の活動に素早く到達できます。" },
  { title: "連絡先は非公開で安心", body: "本名・電話・メールは他の利用者に公開されず、連絡は募集ごとのグループチャットで行います。" },
];

// 利用の流れ（top_page_design §16）。
const FLOW: string[] = [
  "種目または地域を選ぶ",
  "仲間募集を確認する",
  "参加申請する",
  "グループチャットで調整する",
  "当日活動する",
];

export default async function HomePage() {
  const supabase = await createServerClient();

  // 新着仲間募集（ランニング。実装済み種目）と、おすすめ施設（共通DB・確認済み）。
  const [events, facRes] = await Promise.all([
    fetchEvents(supabase, {}),
    supabase
      .schema(SCHEMA.facility)
      .from("facilities")
      .select("id, name, facility_type, prefecture, city")
      .eq("status", "verified")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const newRecruitments = events.slice(0, 6);
  type Fac = { id: string; name: string; facility_type: string | null; prefecture: string | null; city: string | null };
  const facilities = (facRes.data ?? []) as Fac[];

  return (
    <div className="space-y-12">
      {/* 1. ヒーロー */}
      <section className="relative overflow-hidden">
        <Image src={heroImage} alt="スポーツ・レジャーの仲間を見つけよう" priority className="h-auto w-full" />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4 sm:p-8">
          <h1 className="text-3xl font-bold text-white drop-shadow sm:text-5xl">スポーツ・レジャーの仲間を見つけよう</h1>
          <p className="mt-3 max-w-3xl text-base font-medium text-white/95 drop-shadow sm:text-xl">
            ゴルフ、ランニング、アウトドア、球技、フィットネスなど、さまざまな活動の仲間募集・施設検索・イベント情報を1つのサイトで探せます。
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Link href="/running" className="rounded-md bg-white px-5 py-2.5 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50">仲間募集を探す</Link>
            <Link href="/events/new" className="rounded-md bg-emerald-600 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700">仲間を募集する</Link>
            <Link href="/facilities" className="rounded-md border border-white/80 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-white/10">施設を探す</Link>
          </div>
        </div>
      </section>

      {/* 2. 検索エリア（共通施設DB＝全国データを横断検索） */}
      <section>
        <form className="card flex flex-wrap items-end gap-3 p-4" action="/facilities">
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-slate-500">キーワード</label>
            <input name="q" placeholder="施設名・地域" className="input w-56" />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-slate-500">地域</label>
            <select name="pref" className="input w-40">
              <option value="">都道府県</option>
              {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button className="btn-primary" type="submit">施設を検索</button>
        </form>
      </section>

      {/* 3. 種目から探す */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-slate-900">種目から探す</h2>
          <Link href="/facilities" className="text-sm text-brand hover:underline">すべての施設 →</Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SPORT_CARDS.map((c) => (
            <a key={c.slug} href={c.href} className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.logo} alt={c.label} className="h-full w-full object-contain" />
              </span>
              <span className="flex flex-col">
                <span className="text-base font-semibold text-slate-900">{c.label}</span>
                <span className="text-xs text-slate-500">{c.desc}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* 4. 新着仲間募集 */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-slate-900">新着の仲間募集</h2>
          <Link href="/running" className="text-sm text-brand hover:underline">もっと見る →</Link>
        </div>
        {newRecruitments.length === 0 ? (
          <p className="text-slate-500">現在募集中の投稿はありません。最初の募集を作成してみましょう。</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {newRecruitments.map((r) => <EventCard key={r.id} event={r} sportLabel="ランニング" />)}
          </div>
        )}
      </section>

      {/* 5. おすすめ施設 */}
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
                <div className="text-sm text-slate-500">
                  {f.facility_type ? `${f.facility_type}・` : ""}{f.prefecture}{f.city}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 6. サービスの特徴 */}
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

      {/* 7. 利用の流れ */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-slate-900">仲間を探す流れ</h2>
        <ol className="grid gap-3 sm:grid-cols-5">
          {FLOW.map((step, i) => (
            <li key={i} className="card flex flex-col items-center gap-2 p-4 text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{i + 1}</span>
              <span className="text-sm text-slate-700">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
