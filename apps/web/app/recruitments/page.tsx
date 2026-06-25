import Link from "next/link";
import { createServerClient } from "@spotomo/auth-client";
import { EventCard } from "@spotomo/shared-ui";
import { PREFECTURES } from "@spotomo/shared-types";
import { fetchEvents } from "../../lib/events";
import { fetchSportNodes, resolveCategorySportIds } from "../../lib/category";

export const metadata = {
  title: "仲間募集を探す",
  description: "スポーツ・レジャーの仲間募集を分類・地域・キーワードから探せます。",
};

// 仲間募集一覧（画面遷移図 /recruitments）。分類（大分類=種目）+ 地域 + キーワードで絞り込む。
export default async function Recruitments({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pref?: string; area?: string; category?: string; beginner?: string }>;
}) {
  const sp = await searchParams;
  const prefecture = sp.area || sp.pref; // 目的別検索は area、ページ内検索は pref
  const supabase = await createServerClient();

  const nodes = await fetchSportNodes(supabase);
  const parents = nodes.filter((n) => !n.parent_id); // 大分類
  const sportIds = resolveCategorySportIds(nodes, sp.category); // null=絞り込みなし / []=該当なし

  const events = await fetchEvents(supabase, {
    keyword: sp.q,
    prefecture,
    beginnerOnly: sp.beginner === "1",
    ...(sportIds ? { sportIds } : {}),
  });
  const sportName = new Map(nodes.map((n) => [n.id, n.name]));

  // 分類セレクトの現在値（cat-* 大分類スラッグ。トップのUIスラッグも大分類に正規化）。
  const selectedCat = sp.category
    ? (parents.find((p) => p.slug === sp.category)?.slug
        ?? parents.find((p) => resolveCategorySportIds(nodes, sp.category)?.includes(p.id))?.slug
        ?? "")
    : "";

  const createParams = new URLSearchParams();
  if (sp.category) createParams.set("category", sp.category);
  if (prefecture) createParams.set("area", prefecture);
  const createHref = `/facilities${createParams.toString() ? `?${createParams.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">仲間募集を探す</h1>
        <Link href="/facilities" className="btn-primary text-sm">施設を選んで募集する</Link>
      </div>

      <form className="card flex flex-wrap items-end gap-2 p-4" action="/recruitments">
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-slate-500">分類</label>
          <select name="category" defaultValue={selectedCat} className="input max-w-[12rem]">
            <option value="">すべての分類</option>
            {parents.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-slate-500">地域</label>
          <select name="pref" defaultValue={prefecture ?? ""} className="input max-w-[10rem]">
            <option value="">都道府県</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-slate-500">キーワード</label>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="キーワード" className="input max-w-xs" />
        </div>
        <label className="flex items-center gap-1 pb-2 text-sm">
          <input type="checkbox" name="beginner" value="1" defaultChecked={sp.beginner === "1"} />
          初心者歓迎のみ
        </label>
        <button className="btn-outline" type="submit">検索</button>
      </form>

      {events.length === 0 ? (
        <div className="card space-y-3 p-6 text-center">
          <p className="text-slate-600">該当する募集はまだありません。条件を変更するか、この条件で募集を作成できます。</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/recruitments" className="btn-outline">条件を変更する</Link>
            <Link href={createHref} className="btn-primary">この条件で募集を作成する</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((r) => (
            <EventCard key={r.id} event={r} sportLabel={sportName.get((r as { sport_id?: string }).sport_id ?? "") ?? "種目"} hrefBase="/recruitments" />
          ))}
        </div>
      )}
    </div>
  );
}
