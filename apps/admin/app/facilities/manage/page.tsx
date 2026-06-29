import Link from "next/link";
import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";
import { PREFECTURES } from "@spotomo/shared-types";

export const metadata = { title: "施設の管理" };

const PER_PAGE = 25;
const STATUS_LABEL: Record<string, string> = { verified: "公開", unverified: "未承認", rejected: "却下" };

// 施設の検索・一覧（全 status）。ここから新規登録・編集・削除へ。
export default async function FacilityManagePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pref?: string; status?: string; page?: string; saved?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PER_PAGE;
  const supabase = await createServerClient();

  let query = supabase
    .schema(SCHEMA.facility)
    .from("facilities")
    .select("id, name, facility_type, prefecture, city, status", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);
  if (sp.q) query = query.ilike("name", `%${sp.q}%`);
  if (sp.pref) query = query.eq("prefecture", sp.pref);
  if (sp.status) query = query.eq("status", sp.status);
  const { data, count } = await query;

  type Row = { id: string; name: string; facility_type: string | null; prefecture: string | null; city: string | null; status: string };
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.pref) params.set("pref", sp.pref);
    if (sp.status) params.set("status", sp.status);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/facilities/manage?${s}` : "/facilities/manage";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">施設の管理</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/facilities/manage/new" className="btn-primary">＋ 新規登録</Link>
          <Link href="/" className="text-brand hover:underline">← ダッシュボード</Link>
        </div>
      </div>

      {sp.saved && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">施設情報を保存しました。</p>
      )}

      <form className="card flex flex-wrap items-center gap-2 p-4" action="/facilities/manage">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="施設名キーワード" className="input max-w-xs" />
        <select name="pref" defaultValue={sp.pref ?? ""} className="input max-w-[10rem]">
          <option value="">都道府県（すべて）</option>
          {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="input max-w-[10rem]">
          <option value="">状態（すべて）</option>
          <option value="verified">公開</option>
          <option value="unverified">未承認</option>
          <option value="rejected">却下</option>
        </select>
        <button className="btn-outline" type="submit">検索</button>
      </form>

      <p className="text-sm text-slate-500">{total}件中 {total === 0 ? 0 : from + 1}〜{Math.min(from + PER_PAGE, total)}件</p>

      {rows.length === 0 ? (
        <p className="text-slate-500">該当する施設がありません。</p>
      ) : (
        <ul className="card divide-y p-0 text-sm">
          {rows.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/facilities/manage/${f.id}`} className="min-w-0 hover:underline">
                <span className="block font-medium">{f.name}</span>
                <span className="block text-slate-500">{f.facility_type ? `${f.facility_type}・` : ""}{f.prefecture ?? ""}{f.city ?? ""}</span>
              </Link>
              <span className={`shrink-0 text-xs ${f.status === "verified" ? "text-emerald-700" : "text-slate-400"}`}>
                {STATUS_LABEL[f.status] ?? f.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          {page > 1 ? <Link href={qs(page - 1)} className="btn-outline">← 前へ</Link> : <span className="btn-outline pointer-events-none opacity-40">← 前へ</span>}
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          {page < totalPages ? <Link href={qs(page + 1)} className="btn-outline">次へ →</Link> : <span className="btn-outline pointer-events-none opacity-40">次へ →</span>}
        </div>
      )}
    </div>
  );
}
