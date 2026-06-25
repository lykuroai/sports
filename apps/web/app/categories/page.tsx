import Link from "next/link";
import { createServerClient } from "@spotomo/auth-client";
import { fetchSportNodes } from "../../lib/category";

export const metadata = { title: "種目・カテゴリ一覧" };

// 全カテゴリ（大分類）一覧（top_page_design §11 / 画面遷移図 /categories）。
export default async function CategoriesPage() {
  const supabase = await createServerClient();
  const nodes = await fetchSportNodes(supabase);
  const parents = nodes.filter((n) => !n.parent_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">種目から探す</h1>
        <Link href="/" className="text-sm text-brand hover:underline">← トップにもどる</Link>
      </div>
      <p className="text-sm text-slate-500">種目を選ぶと、その種目の仲間募集・施設・小カテゴリを探せます。</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {parents.map((p) => {
          const children = nodes.filter((n) => n.parent_id === p.id);
          return (
            <Link key={p.id} href={`/sports/${p.slug}`} className="card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-lg font-bold text-emerald-700">
                  {p.name.slice(0, 1)}
                </span>
                <span className="font-semibold text-slate-900">{p.name}</span>
              </div>
              {children.length > 0 && (
                <p className="mt-2 line-clamp-2 text-xs text-slate-500">{children.map((c) => c.name).join("・")}</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
