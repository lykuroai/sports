import Link from "next/link";
import { createServerClient } from "@spotomo/auth-client";
import { EventCard } from "@spotomo/shared-ui";
import { PREFECTURES } from "@spotomo/shared-types";
import { fetchEvents } from "../../lib/events";

export const metadata = {
  title: "仲間募集を探す",
  description: "スポーツ・レジャーの仲間募集を地域・キーワード・レベルで横断検索できます。",
};

// 仲間募集一覧（画面遷移図 /recruitments）。全カテゴリ横断の募集一覧。
// 現状は実装済み種目（ランニング）の募集を表示する。
export default async function Recruitments({
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">仲間募集を探す</h1>
        <Link href="/recruitments/new" className="btn-primary text-sm">仲間を募集する</Link>
      </div>

      <form className="card flex flex-wrap items-end gap-2 p-4" action="/recruitments">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="キーワード" className="input max-w-xs" />
        <select name="pref" defaultValue={sp.pref ?? ""} className="input max-w-[10rem]">
          <option value="">都道府県</option>
          {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="beginner" value="1" defaultChecked={sp.beginner === "1"} />
          初心者歓迎のみ
        </label>
        <button className="btn-outline" type="submit">検索</button>
      </form>

      {events.length === 0 ? (
        <p className="text-slate-500">条件に合う仲間募集がありません。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((r) => <EventCard key={r.id} event={r} sportLabel="ランニング" hrefBase="/recruitments" />)}
        </div>
      )}
    </div>
  );
}
