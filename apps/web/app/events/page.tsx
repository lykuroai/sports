import Link from "next/link";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { PREFECTURES } from "@spotomo/shared-types";

export const metadata = { title: "大会を探す" };

const PER_PAGE = 24;

type Race = {
  id: string;
  name: string;
  prefecture: string | null;
  city: string | null;
  event_date: string | null;
  website_url: string | null;
  wikipedia_title: string | null;
  discontinued: boolean;
};

// マラソン・駅伝・ロードレース等の競技大会カタログ。キーワード/都道府県が主条件。
// データは Wikipedia/Wikidata 由来（data/running/collect_races.py）。
export default async function RaceSearch({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pref?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PER_PAGE;

  const supabase = await createServerClient();
  let query = supabase
    .schema(SCHEMA.running)
    .from("races")
    .select("id, name, prefecture, city, event_date, website_url, wikipedia_title, discontinued", { count: "exact" })
    .order("prefecture", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .range(from, from + PER_PAGE - 1);
  if (sp.q) query = query.ilike("name", `%${sp.q}%`);
  if (sp.pref) query = query.eq("prefecture", sp.pref);

  const { data, count } = await query;
  const races = (data ?? []) as Race[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.pref) params.set("pref", sp.pref);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/events?${s}` : "/events";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">大会を探す</h1>
        <Link href="/" className="text-sm text-brand hover:underline">← 仲間募集にもどる</Link>
      </div>
      <p className="text-sm text-slate-500">
        全国のマラソン・駅伝・ロードレース大会を検索できます。気になる大会が見つかったら、その大会に向けて一緒に走る仲間を募集しましょう。
      </p>

      <form className="card flex flex-wrap items-center gap-2 p-4" action="/events">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="大会名キーワード" className="input max-w-xs" />
        <select name="pref" defaultValue={sp.pref ?? ""} className="input max-w-[10rem]">
          <option value="">都道府県</option>
          {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="btn-outline" type="submit">検索</button>
      </form>

      <p className="text-sm text-slate-500">{total}件中 {total === 0 ? 0 : from + 1}〜{Math.min(from + PER_PAGE, total)}件を表示</p>

      {races.length === 0 ? (
        <p className="text-slate-500">条件に合う大会が見つかりません。</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {races.map((r) => (
            <div key={r.id} className="card flex items-start justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/events/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link>
                  {r.discontinued && (
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">終了</span>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {[r.prefecture, r.city].filter(Boolean).join("") || "開催地は各大会の公式情報をご確認ください"}
                </div>
                {r.event_date && (
                  <div className="mt-0.5 text-sm font-medium text-brand">
                    開催日 {r.event_date}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {r.website_url && (
                    <a href={r.website_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                      公式サイト ↗
                    </a>
                  )}
                  {r.wikipedia_title && (
                    <a
                      href={`https://ja.wikipedia.org/wiki/${encodeURIComponent(r.wikipedia_title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:underline"
                    >
                      Wikipedia ↗
                    </a>
                  )}
                </div>
              </div>
              {r.discontinued ? (
                <span
                  className="btn-outline pointer-events-none shrink-0 cursor-not-allowed whitespace-nowrap text-sm opacity-40"
                  aria-disabled="true"
                  title="終了した大会のため募集できません"
                >
                  仲間を募集
                </span>
              ) : (
                <Link
                  href={`/recruitments/new?race=${encodeURIComponent(r.name)}${r.prefecture ? `&pref=${encodeURIComponent(r.prefecture)}` : ""}`}
                  className="btn-outline shrink-0 whitespace-nowrap text-sm"
                >
                  仲間を募集
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          {page > 1 ? (
            <Link href={qs(page - 1)} className="btn-outline">← 前へ</Link>
          ) : (
            <span className="btn-outline pointer-events-none opacity-40">← 前へ</span>
          )}
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          {page < totalPages ? (
            <Link href={qs(page + 1)} className="btn-outline">次へ →</Link>
          ) : (
            <span className="btn-outline pointer-events-none opacity-40">次へ →</span>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400">
        大会データの出所: Wikipedia（CC BY-SA 4.0）/ Wikidata（CC0）。最新の開催可否・日程・募集要項は必ず各大会の公式情報をご確認ください。
      </p>
    </div>
  );
}
