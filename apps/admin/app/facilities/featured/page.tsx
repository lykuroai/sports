import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";
import { PREFECTURES } from "@spotomo/shared-types";
import { addFeaturedFacility, removeFeaturedFacility, updateFeaturedOrder } from "../../actions";

export const metadata = { title: "おすすめ施設の指定" };

// HOME の「おすすめ施設」を運営が指定する。featured_rank（昇順）で表示順を管理し、
// 検索して追加・削除できる。未指定なら web 側は最新 verified で補完表示する。
export default async function FeaturedFacilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pref?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createServerClient();
  const fac = supabase.schema(SCHEMA.facility);

  // 現在のおすすめ（featured_rank 昇順）。
  const { data: featuredRows } = await fac
    .from("facilities")
    .select("id, name, facility_type, prefecture, city, featured_rank")
    .not("featured_rank", "is", null)
    .order("featured_rank", { ascending: true });

  type Row = {
    id: string; name: string; facility_type: string | null;
    prefecture: string | null; city: string | null; featured_rank: number | null;
  };
  const featured = (featuredRows ?? []) as Row[];
  const featuredIds = new Set(featured.map((f) => f.id));

  // 追加候補の検索（verified のみ。キーワード／都道府県）。検索時のみ実行。
  let candidates: Row[] = [];
  const hasQuery = !!(sp.q || sp.pref);
  if (hasQuery) {
    let q = fac
      .from("facilities")
      .select("id, name, facility_type, prefecture, city, featured_rank")
      .eq("status", "verified")
      .order("name", { ascending: true })
      .limit(30);
    if (sp.q) q = q.ilike("name", `%${sp.q}%`);
    if (sp.pref) q = q.eq("prefecture", sp.pref);
    const { data } = await q;
    candidates = ((data ?? []) as Row[]).filter((c) => !featuredIds.has(c.id));
  }

  const place = (f: Row) => `${f.facility_type ? `${f.facility_type}・` : ""}${f.prefecture ?? ""}${f.city ?? ""}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">おすすめ施設の指定</h1>
        <a href="/" className="text-sm text-brand hover:underline">← ダッシュボード</a>
      </div>
      <p className="text-sm text-slate-500">
        HOME の「おすすめ施設」に表示する施設を指定します（表示順＝順位の昇順、上位6件を表示）。
        未指定のときは最新の承認済み施設が自動表示されます。
      </p>

      {/* 現在のおすすめ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">現在のおすすめ（{featured.length}件）</h2>
        {featured.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            まだ指定されていません。下の検索から施設を追加してください。
          </p>
        ) : (
          <ul className="space-y-2">
            {featured.map((f) => (
              <li key={f.id} className="card flex flex-wrap items-center gap-3 p-3">
                <span className="text-xs text-slate-400">#{f.featured_rank}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{f.name}</span>
                  <span className="block text-sm text-slate-500">{place(f)}</span>
                </span>
                <form action={updateFeaturedOrder} className="flex items-center gap-1">
                  <input type="hidden" name="facility_id" value={f.id} />
                  <input
                    name="rank"
                    type="number"
                    defaultValue={f.featured_rank ?? 0}
                    className="input w-20"
                    aria-label="表示順"
                  />
                  <button className="btn-outline" type="submit">順位保存</button>
                </form>
                <form action={removeFeaturedFacility}>
                  <input type="hidden" name="facility_id" value={f.id} />
                  <button className="btn-outline text-red-600" type="submit">外す</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {featured.length > 6 && (
          <p className="text-xs text-amber-600">※ HOME に表示されるのは上位6件のみです。</p>
        )}
      </section>

      {/* 検索して追加 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">施設を検索して追加</h2>
        <form className="card flex flex-wrap items-center gap-2 p-4" action="/facilities/featured">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="施設名キーワード" className="input max-w-xs" />
          <select name="pref" defaultValue={sp.pref ?? ""} className="input max-w-[10rem]">
            <option value="">都道府県</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="btn-outline" type="submit">検索</button>
        </form>

        {hasQuery && (
          candidates.length === 0 ? (
            <p className="text-sm text-slate-500">該当する施設がありません（または全て追加済みです）。</p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((f) => (
                <li key={f.id} className="card flex flex-wrap items-center gap-3 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{f.name}</span>
                    <span className="block text-sm text-slate-500">{place(f)}</span>
                  </span>
                  <form action={addFeaturedFacility}>
                    <input type="hidden" name="facility_id" value={f.id} />
                    <button className="btn-primary" type="submit">おすすめに追加</button>
                  </form>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </div>
  );
}
