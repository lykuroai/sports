import Link from "next/link";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import type { Facility } from "@spotomo/shared-types";

const PER_PAGE = 24;

// 施設は種目横断の共有資産。地域・キーワードが主条件、現在地周辺は補助（仕様 §3.2）。
export default async function FacilityHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pref?: string; city?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PER_PAGE;

  const supabase = await createServerClient();
  let query = supabase
    .schema(SCHEMA.facility)
    .from("facilities")
    .select("id, name, facility_type, prefecture, city, address", { count: "exact" })
    .order("prefecture", { ascending: true })
    .order("name", { ascending: true })
    .range(from, from + PER_PAGE - 1);
  if (sp.q) query = query.ilike("name", `%${sp.q}%`);
  if (sp.pref) query = query.eq("prefecture", sp.pref);
  if (sp.city) query = query.ilike("city", `%${sp.city}%`);

  const { data, count } = await query;
  const facilities = (data ?? []) as Facility[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.pref) params.set("pref", sp.pref);
    if (sp.city) params.set("city", sp.city);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">施設を探す</h1>
        <Link href="/submit" className="btn-outline">施設の登録・修正を申請</Link>
      </div>

      <form className="card flex flex-wrap items-center gap-2 p-4" action="/">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="施設名キーワード" className="input max-w-xs" />
        <input name="pref" defaultValue={sp.pref ?? ""} placeholder="都道府県" className="input max-w-[10rem]" />
        <input name="city" defaultValue={sp.city ?? ""} placeholder="市区町村" className="input max-w-[10rem]" />
        <button className="btn-outline" type="submit">検索</button>
        <Link href="/nearby" className="text-sm text-brand hover:underline">現在地周辺（補助）</Link>
      </form>

      <p className="text-sm text-slate-500">{total}件中 {total === 0 ? 0 : from + 1}〜{Math.min(from + PER_PAGE, total)}件を表示</p>

      {facilities.length === 0 ? (
        <p className="text-slate-500">施設が見つかりません。</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {facilities.map((f) => (
            <Link key={f.id} href={`/facilities/${f.id}`} className="card p-4 hover:shadow">
              <div className="font-medium">{f.name}</div>
              <div className="text-sm text-slate-500">
                {f.facility_type ? `${f.facility_type}・` : ""}{f.prefecture}{f.city}{f.address}
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

      <p className="text-xs text-slate-400">
        施設運営者の方は <Link href="/owner" className="text-brand hover:underline">運営者ダッシュボード</Link> から自施設を無料で管理できます。
      </p>
    </div>
  );
}
