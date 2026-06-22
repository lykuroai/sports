import Link from "next/link";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import type { Facility } from "@spotomo/shared-types";

// 施設は種目横断の共有資産。地域検索が主条件、現在地周辺は補助（仕様 §3.2）。
export default async function FacilityHome({
  searchParams,
}: {
  searchParams: Promise<{ pref?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();
  let query = supabase.schema(SCHEMA.facility).from("facilities").select("*").limit(50);
  if (sp.pref) query = query.eq("prefecture", sp.pref);
  const { data } = await query;
  const facilities = (data ?? []) as Facility[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">施設を探す</h1>
        <Link href="/submit" className="btn-outline">施設の登録・修正を申請</Link>
      </div>

      <form className="card flex items-center gap-2 p-4" action="/">
        <input name="pref" defaultValue={sp.pref ?? ""} placeholder="都道府県" className="input max-w-[12rem]" />
        <button className="btn-outline" type="submit">地域で検索</button>
        <Link href="/nearby" className="text-sm text-brand hover:underline">現在地周辺（補助）</Link>
      </form>

      {facilities.length === 0 ? (
        <p className="text-slate-500">施設が見つかりません。</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {facilities.map((f) => (
            <Link key={f.id} href={`/facilities/${f.id}`} className="card p-4 hover:shadow">
              <div className="font-medium">{f.name}</div>
              <div className="text-sm text-slate-500">{f.prefecture}{f.city}{f.address}</div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">
        施設運営者の方は <Link href="/owner" className="text-brand hover:underline">運営者ダッシュボード</Link> から自施設を無料で管理できます。
      </p>
    </div>
  );
}
