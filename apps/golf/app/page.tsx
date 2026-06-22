import Link from "next/link";
import { createServerClient } from "@spotomo/auth-client";
import { EventCard } from "@spotomo/shared-ui";
import { fetchEvents } from "../lib/events";

export default async function GolfHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pref?: string; beginner?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();
  const events = await fetchEvents(supabase, {
    keyword: sp.q,
    prefecture: sp.pref,
    beginnerOnly: sp.beginner === "1",
  });

  return (
    <div className="space-y-6">
      {/* ヒーロー（仮プレースホルダー。後で画像に差し替え可能）。 */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 px-6 py-12 text-white sm:px-10 sm:py-16">
        <div className="relative z-10 max-w-xl space-y-3">
          <h1 className="text-2xl font-bold sm:text-3xl">ゴルフ仲間を見つけよう</h1>
          <p className="text-sm text-emerald-50 sm:text-base">
            一緒にラウンドする仲間を募集・検索。ゴルフ場を探して、その場で募集を作成できます。
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/clubs" className="rounded-md bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
              ゴルフ場を探す
            </Link>
            <Link href="/events/new" className="rounded-md border border-white/70 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
              募集を作成
            </Link>
          </div>
        </div>
        {/* 装飾。実画像導入時はここを背景画像に置き換える。 */}
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 right-20 h-56 w-56 rounded-full bg-white/5" />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">検索</h2>
        <form className="card flex flex-wrap gap-2 p-4" action="/">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="キーワード" className="input max-w-xs" />
          <input name="pref" defaultValue={sp.pref ?? ""} placeholder="都道府県" className="input max-w-[10rem]" />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="beginner" value="1" defaultChecked={sp.beginner === "1"} />
            初心者歓迎のみ
          </label>
          <button className="btn-outline" type="submit">検索</button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">募集一覧</h2>
        {events.length === 0 ? (
          <p className="text-slate-500">条件に合う募集がありません。</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((r) => (
              <EventCard key={r.id} event={r} sportLabel="ゴルフ" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
