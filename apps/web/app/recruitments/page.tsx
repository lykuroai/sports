import Link from "next/link";
import { createServerClient } from "@spotomo/auth-client";
import { EventCard } from "@spotomo/shared-ui";
import { PREFECTURES } from "@spotomo/shared-types";
import { fetchEvents } from "../../lib/events";

export const metadata = {
  title: "仲間募集を探す",
  description: "スポーツ・レジャーの仲間募集を分類・地域・キーワードから探せます。",
};

// 仲間募集一覧（画面遷移図 /recruitments）。トップの目的別検索「募集に参加する」から
// category（分類=種目）+ area（地域=都道府県）で遷移する。現状の実装種目はランニング。
export default async function Recruitments({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pref?: string; area?: string; category?: string; beginner?: string }>;
}) {
  const sp = await searchParams;
  const prefecture = sp.area || sp.pref; // 目的別検索は area、ページ内検索は pref
  const supabase = await createServerClient();

  // 分類（種目）指定が実装済みのランニング以外なら、その種目の募集はまだ無い。
  const otherCategory = !!sp.category && sp.category !== "running";
  const events = otherCategory
    ? []
    : await fetchEvents(supabase, { keyword: sp.q, prefecture, beginnerOnly: sp.beginner === "1" });

  const createHref = `/facilities${sp.category || prefecture ? `?${new URLSearchParams({ ...(sp.category ? { category: sp.category } : {}), ...(prefecture ? { area: prefecture } : {}) }).toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">仲間募集を探す</h1>
        <Link href="/facilities" className="btn-primary text-sm">施設を選んで募集する</Link>
      </div>

      <form className="card flex flex-wrap items-end gap-2 p-4" action="/recruitments">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="キーワード" className="input max-w-xs" />
        <select name="pref" defaultValue={prefecture ?? ""} className="input max-w-[10rem]">
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
        <div className="card space-y-3 p-6 text-center">
          <p className="text-slate-600">該当する募集はまだありません。条件を変更するか、この地域で募集を作成できます。</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/recruitments" className="btn-outline">条件を変更する</Link>
            <Link href={createHref} className="btn-primary">この条件で募集を作成する</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((r) => <EventCard key={r.id} event={r} sportLabel="ランニング" hrefBase="/recruitments" />)}
        </div>
      )}
    </div>
  );
}
