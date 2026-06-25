import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";
import { PREFECTURES } from "@spotomo/shared-types";
import { reviewImportedFacility, mergeImportedFacility, bulkReviewImportedFacilities } from "../actions";

export const metadata = { title: "取り込み施設の承認" };

const PER_PAGE = 20;

// 自動取り込み（OSM等）された未承認施設（status='unverified'）を確認し、承認(verified)で
// 公開、または却下(rejected)する。出所(facility_sources)と重複候補を併記し、公開前承認の
// 判断材料を示す（仕様 §21.2 / facility_data §15・§18.3）。件数が多いため県フィルタ・
// ページング・一括承認を備える。
export default async function ImportedFacilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ pref?: string; dup?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PER_PAGE;
  const supabase = await createServerClient();

  let query = supabase
    .schema(SCHEMA.facility)
    .from("facilities")
    .select("id, name, facility_type, prefecture, city, address, latitude, longitude", { count: "exact" })
    .eq("status", "unverified")
    .order("prefecture", { ascending: true })
    .order("created_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);
  if (sp.pref) query = query.eq("prefecture", sp.pref);

  const { data, count } = await query;

  type Row = {
    id: string; name: string; facility_type: string | null;
    prefecture: string | null; city: string | null; address: string | null;
    latitude: number | null; longitude: number | null;
  };
  const facilities = (data ?? []) as Row[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // 各施設の出所と重複候補を取得（1ページ分のみ）。
  const enriched = await Promise.all(
    facilities.map(async (f) => {
      const [{ data: sources }, { data: dups }] = await Promise.all([
        supabase
          .schema(SCHEMA.facility)
          .from("facility_sources")
          .select("source_type, source_url, license")
          .eq("facility_id", f.id),
        supabase.schema(SCHEMA.facility).rpc("find_duplicate_candidates", {
          p_name: f.name, p_lat: f.latitude, p_lng: f.longitude, p_radius_m: 100, p_lim: 5,
        }),
      ]);
      type Cand = { id: string; name: string; name_sim: number | null; distance_m: number | null };
      const candidates = ((dups ?? []) as Cand[]).filter((c) => c.id !== f.id);
      return {
        ...f,
        sources: (sources ?? []) as { source_type: string; source_url: string | null; license: string | null }[],
        candidates,
      };
    }),
  );

  // 重複ありのみ表示（dup=1）。重複判定は RPC 結果に依存するため取得後に絞り込む。
  const dupOnly = sp.dup === "1";
  const shown = dupOnly ? enriched.filter((f) => f.candidates.length > 0) : enriched;

  const qs = (next: Partial<{ pref: string; dup: string; page: number }>) => {
    const params = new URLSearchParams();
    const pref = next.pref ?? sp.pref;
    const dup = next.dup ?? sp.dup;
    const p = next.page ?? page;
    if (pref) params.set("pref", pref);
    if (dup === "1") params.set("dup", "1");
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/facilities?${s}` : "/facilities";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">取り込み施設の承認</h1>
        <a href="/batch-runs" className="text-sm text-brand hover:underline">取り込み履歴 →</a>
      </div>
      <p className="text-sm text-slate-500">
        外部データ（OpenStreetMap 等）から自動取り込みされた未承認施設です（全 {total} 件）。
        内容・重複を確認して承認すると施設検索に公開されます。
      </p>

      {/* フィルタ */}
      <form className="card flex flex-wrap items-center gap-2 p-3 text-sm" action="/facilities">
        <select name="pref" defaultValue={sp.pref ?? ""} className="input max-w-[10rem]">
          <option value="">すべての都道府県</option>
          {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="dup" value="1" defaultChecked={dupOnly} /> 重複候補ありのみ
        </label>
        <button className="btn-outline" type="submit">絞り込み</button>
      </form>

      {/* 一括操作（このページの表示分すべて） */}
      {shown.length > 0 && (
        <form action={bulkReviewImportedFacilities} className="card flex flex-wrap items-center gap-2 p-3 text-sm">
          {shown.map((f) => <input key={f.id} type="hidden" name="facility_ids" value={f.id} />)}
          <span className="text-slate-500">このページの {shown.length} 件を：</span>
          <button className="btn-primary" type="submit" name="decision" value="approved">すべて承認</button>
          <button className="btn-outline" type="submit" name="decision" value="rejected">すべて却下</button>
        </form>
      )}

      {shown.length === 0 ? (
        <p className="text-slate-500">対象の取り込み施設はありません。</p>
      ) : shown.map((f) => (
        <div key={f.id} className="card space-y-2 p-4 text-sm">
          <div className="font-medium">{f.name}</div>
          <div className="text-slate-500">
            {f.facility_type ? `${f.facility_type}・` : ""}{f.prefecture}{f.city}{f.address}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            {f.sources.map((s, i) => (
              <span key={i} className="rounded bg-slate-100 px-2 py-0.5">
                出所: {s.source_type}
                {s.source_url && (
                  <a href={s.source_url} target="_blank" rel="noreferrer" className="ml-1 text-brand hover:underline">原本</a>
                )}
                {s.license && <span className="ml-1 text-slate-400">（{s.license}）</span>}
              </span>
            ))}
          </div>

          {f.candidates.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs">
              <div className="font-medium text-amber-800">重複候補あり（要確認）</div>
              <ul className="mt-1 space-y-1 text-amber-900">
                {f.candidates.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    <span>{c.name}</span>
                    <span className="text-amber-700">
                      類似 {c.name_sim != null ? c.name_sim.toFixed(2) : "—"}
                      {c.distance_m != null ? ` / ${Math.round(c.distance_m)}m` : ""}
                    </span>
                    <form action={mergeImportedFacility}>
                      <input type="hidden" name="source_facility_id" value={f.id} />
                      <input type="hidden" name="target_facility_id" value={c.id} />
                      <button className="rounded border border-amber-400 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100" type="submit">
                        この施設へ統合
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <form action={reviewImportedFacility}>
              <input type="hidden" name="facility_id" value={f.id} />
              <input type="hidden" name="decision" value="approved" />
              <button className="btn-primary" type="submit">承認して公開</button>
            </form>
            <form action={reviewImportedFacility}>
              <input type="hidden" name="facility_id" value={f.id} />
              <input type="hidden" name="decision" value="rejected" />
              <button className="btn-outline" type="submit">却下</button>
            </form>
          </div>
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          {page > 1 ? (
            <a href={qs({ page: page - 1 })} className="btn-outline">← 前へ</a>
          ) : (
            <span className="btn-outline pointer-events-none opacity-40">← 前へ</span>
          )}
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          {page < totalPages ? (
            <a href={qs({ page: page + 1 })} className="btn-outline">次へ →</a>
          ) : (
            <span className="btn-outline pointer-events-none opacity-40">次へ →</span>
          )}
        </div>
      )}
    </div>
  );
}
