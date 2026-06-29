import Link from "next/link";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { PREFECTURES } from "@spotomo/shared-types";
import type { Facility } from "@spotomo/shared-types";
import { fetchSportNodes, resolveCategorySportIds } from "../../lib/category";

export const metadata = { title: "施設を探す" };

const PER_PAGE = 24;

// 施設一覧（画面遷移図 /facilities）。トップの目的別検索「募集を作成する」から
// category（分類=種目）+ area（地域=都道府県）で遷移する。種目は facility_sports で絞る。
export default async function FacilitySearch({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pref?: string; area?: string; category?: string; type?: string; purpose?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PER_PAGE;
  const prefecture = sp.area || sp.pref;
  const forCreate = sp.purpose === "create_recruitment";

  const supabase = await createServerClient();

  // 種目（大分類/小分類）。検索フォームの種目セレクトと facility_sports 絞り込みに使う。
  const nodes = await fetchSportNodes(supabase);
  const parents = nodes.filter((n) => !n.parent_id);
  // セレクトの現在値（cat-* 大分類スラッグ。トップのUIスラッグも大分類に正規化）。
  const selectedCat = sp.category
    ? (parents.find((p) => p.slug === sp.category)?.slug
        ?? parents.find((p) => resolveCategorySportIds(nodes, sp.category)?.includes(p.id))?.slug
        ?? "")
    : "";

  // 種目（分類）は任意。選択時は facility_sports で絞り、未選択なら全 verified を対象。
  // category → sport_id 群を解決（大分類なら配下の小分類も含める）。null=未指定、[]=不正 slug。
  const sportIds = sp.category ? (resolveCategorySportIds(nodes, sp.category) ?? []) : null;
  // 種目を指定したのに該当 sport が無い場合のみ 0 件（不正な category）。
  const noMatch = sportIds !== null && sportIds.length === 0;
  const filterBySport = sportIds !== null && sportIds.length > 0;

  let facilities: Facility[] = [];
  let total = 0;
  if (!noMatch) {
    // 種目絞り込みは facility_sports の inner join 埋め込みで行う（sport_id 配列で絞るため
    // URL が短く済む。施設IDを数千件 .in する旧方式は URL 長すぎで失敗していた）。
    let query = supabase
      .schema(SCHEMA.facility)
      .from("facilities")
      .select(
        filterBySport
          ? "id, name, facility_type, description, prefecture, city, address, facility_sports!inner(sport_id)"
          : "id, name, facility_type, description, prefecture, city, address",
        { count: "exact" },
      )
      // 自動取得（OSM等）の未承認施設は公開前承認まで一覧に出さない（仕様 §21.2）。
      .eq("status", "verified")
      .order("prefecture", { ascending: true })
      .order("name", { ascending: true })
      .range(from, from + PER_PAGE - 1);
    if (filterBySport) query = query.in("facility_sports.sport_id", sportIds);
    if (sp.q) query = query.ilike("name", `%${sp.q}%`);
    if (prefecture) query = query.eq("prefecture", prefecture);
    if (sp.type) query = query.eq("facility_type", sp.type);
    const { data, count } = await query;
    facilities = (data ?? []) as unknown as Facility[];
    total = count ?? 0;
  }
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // 表示中の施設のサムネイル（display_order 最小の1枚）をまとめて取得。
  const imageMap = new Map<string, string>();
  if (facilities.length > 0) {
    const { data: imgRows } = await supabase
      .schema(SCHEMA.facility)
      .from("facility_images")
      .select("facility_id, url, display_order")
      .in("facility_id", facilities.map((f) => f.id))
      .order("display_order", { ascending: true });
    for (const row of (imgRows ?? []) as { facility_id: string; url: string }[]) {
      if (row.url && !imageMap.has(row.facility_id)) imageMap.set(row.facility_id, row.url);
    }
  }

  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (prefecture) params.set("pref", prefecture);
    if (sp.category) params.set("category", sp.category);
    if (sp.type) params.set("type", sp.type);
    if (forCreate) params.set("purpose", "create_recruitment");
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/facilities?${s}` : "/facilities";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{forCreate ? "募集する施設を探す" : "施設を探す"}</h1>
        <Link href="/" className="text-sm text-brand hover:underline">← トップにもどる</Link>
      </div>

      {forCreate && (
        <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
          募集を開催する施設を選んでください。施設詳細から「この施設で募集を作成」へ進めます。
        </p>
      )}

      <form className="card flex flex-wrap items-center gap-2 p-4" action="/facilities">
        {/* 種目は任意。未選択なら全施設から検索する。 */}
        <select name="category" defaultValue={selectedCat} className="input max-w-[12rem]">
          <option value="">種目（すべて）</option>
          {parents.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
        </select>
        <select name="pref" defaultValue={prefecture ?? ""} className="input max-w-[10rem]">
          <option value="">都道府県</option>
          {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="施設名キーワード" className="input max-w-xs" />
        {forCreate && <input type="hidden" name="purpose" value="create_recruitment" />}
        <button className="btn-outline" type="submit">検索</button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{total}件中 {total === 0 ? 0 : from + 1}〜{Math.min(from + PER_PAGE, total)}件を表示</p>
        <Link href="/facilities/register" className="text-sm text-brand hover:underline">施設が見つからない場合は登録する →</Link>
      </div>

      {facilities.length === 0 ? (
        <div className="card space-y-3 p-6 text-center">
          <p className="text-slate-600">該当する施設が見つかりません。条件を変更するか、施設を登録して募集を作成できます。</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/facilities" className="btn-outline">条件を変更する</Link>
            <Link href="/facilities/register" className="btn-primary">施設を登録する</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {facilities.map((f) => (
            <Link key={f.id} href={`/facilities/${f.id}${forCreate ? "?purpose=create_recruitment" : ""}`} className="card overflow-hidden p-0 hover:shadow">
              {imageMap.has(f.id) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageMap.get(f.id)} alt={f.name} className="h-40 w-full object-cover" />
              )}
              <div className="p-4">
                <div className="font-medium">{f.name}</div>
                <div className="text-sm text-slate-500">
                  {f.facility_type ? `${f.facility_type}・` : ""}{f.prefecture}{f.city}{f.address}
                </div>
                {f.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{f.description}</p>}
                {forCreate && <div className="mt-2 text-sm font-medium text-sky-700">この施設で募集を作成 →</div>}
              </div>
            </Link>
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
    </div>
  );
}
