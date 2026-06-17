import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchRecruitments, type RecruitmentSort } from "@/lib/recruitments";
import { RecruitmentCard } from "@/components/recruitment-card";
import { PREFECTURES } from "@/lib/constants";

export const metadata = { title: "募集を探す" };

type SearchParams = Promise<{
  keyword?: string;
  sport?: string;
  prefecture?: string;
  beginner?: string;
  open?: string;
  sort?: string;
}>;

export default async function RecruitmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: sports } = await supabase
    .from("sports")
    .select("name, slug")
    .eq("status", "published")
    .order("display_order");

  const recruitments = await fetchRecruitments(supabase, {
    keyword: sp.keyword,
    sportSlug: sp.sport,
    prefecture: sp.prefecture,
    beginnerOnly: sp.beginner === "1",
    openOnly: sp.open === "1",
    sort: (sp.sort as RecruitmentSort) ?? "soon",
  });

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      {/* 検索条件（仕様 §6.2） */}
      <aside className="card h-fit p-4">
        <h2 className="mb-3 font-bold">検索条件</h2>
        <form className="space-y-4 text-sm" method="get">
          <div>
            <label className="label" htmlFor="keyword">キーワード</label>
            <input id="keyword" name="keyword" defaultValue={sp.keyword} className="input" placeholder="例: 初心者 テニス" />
          </div>
          <div>
            <label className="label" htmlFor="sport">種目</label>
            <select id="sport" name="sport" defaultValue={sp.sport ?? ""} className="input">
              <option value="">すべて</option>
              {(sports ?? []).map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="prefecture">都道府県</label>
            <select id="prefecture" name="prefecture" defaultValue={sp.prefecture ?? ""} className="input">
              <option value="">すべて</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sort">並び順</label>
            <select id="sort" name="sort" defaultValue={sp.sort ?? "soon"} className="input">
              <option value="soon">開催日が近い順</option>
              <option value="new">新着順</option>
              <option value="fee">参加費が安い順</option>
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="beginner" value="1" defaultChecked={sp.beginner === "1"} />
            初心者参加可のみ
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="open" value="1" defaultChecked={sp.open === "1"} />
            募集中のみ
          </label>
          <button type="submit" className="btn-primary w-full">この条件で検索</button>
        </form>
      </aside>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">募集一覧（{recruitments.length}件）</h1>
          <Link href="/recruitments/new" className="btn-primary">募集を作成</Link>
        </div>
        {recruitments.length === 0 ? (
          <p className="card p-8 text-center text-slate-500">
            条件に合う募集が見つかりませんでした。
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {recruitments.map((r) => (
              <RecruitmentCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
