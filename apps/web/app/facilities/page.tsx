import Link from "next/link";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { PREFECTURES } from "@spotomo/shared-types";
import type { Facility } from "@spotomo/shared-types";

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

  // category（種目）指定時は facility_sports で対象施設IDを先に絞る。
  let sportFacilityIds: string[] | null = null;
  if (sp.category) {
    const { data: sport } = await supabase.schema(SCHEMA.core).from("sports").select("id").eq("slug", sp.category).maybeSingle();
    const sportId = (sport as { id: string } | null)?.id;
    if (!sportId) {
      sportFacilityIds = [];
    } else {
      const { data: links } = await supabase.schema(SCHEMA.facility).from("facility_sports").select("facility_id").eq("sport_id", sportId).limit(1000);
      sportFacilityIds = [...new Set((links ?? []).map((l: { facility_id: string }) => l.facility_id))];
    }
  }

  let facilities: Facility[] = [];
  let total = 0;
  if (sportFacilityIds === null || sportFacilityIds.length > 0) {
    let query = supabase
      .schema(SCHEMA.facility)
      .from("facilities")
      .select("id, name, facility_type, prefecture, city, address", { count: "exact" })
      // 自動取得（OSM等）の未承認施設は公開前承認まで一覧に出さない（仕様 §21.2）。
      .eq("status", "verified")
      .order("prefecture", { ascending: true })
      .order("name", { ascending: true })
      .range(from, from + PER_PAGE - 1);
    if (sportFacilityIds) query = query.in("id", sportFacilityIds);
    if (sp.q) query = query.ilike("name", `%${sp.q}%`);
    if (prefecture) query = query.eq("prefecture", prefecture);
    if (sp.type) query = query.eq("facility_type", sp.type);
    const { data, count } = await query;
    facilities = (data ?? []) as Facility[];
    total = count ?? 0;
  }
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

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
        <input name="q" defaultValue={sp.q ?? ""} placeholder="施設名キーワード" className="input max-w-xs" />
        <select name="pref" defaultValue={prefecture ?? ""} className="input max-w-[10rem]">
          <option value="">都道府県</option>
          {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {sp.category && <input type="hidden" name="category" value={sp.category} />}
        {forCreate && <input type="hidden" name="purpose" value="create_recruitment" />}
        <button className="btn-outline" type="submit">検索</button>
      </form>

      <p className="text-sm text-slate-500">{total}件中 {total === 0 ? 0 : from + 1}〜{Math.min(from + PER_PAGE, total)}件を表示</p>

      {facilities.length === 0 ? (
        <div className="card space-y-3 p-6 text-center">
          <p className="text-slate-600">該当する施設が見つかりません。条件を変更するか、施設を登録して募集を作成できます。</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/facilities" className="btn-outline">条件を変更する</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {facilities.map((f) => (
            <Link key={f.id} href={`/facilities/${f.id}${forCreate ? "?purpose=create_recruitment" : ""}`} className="card p-4 hover:shadow">
              <div className="font-medium">{f.name}</div>
              <div className="text-sm text-slate-500">
                {f.facility_type ? `${f.facility_type}・` : ""}{f.prefecture}{f.city}{f.address}
              </div>
              {forCreate && <div className="mt-2 text-sm font-medium text-sky-700">この施設で募集を作成 →</div>}
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
