import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";
import { toggleSportStatus, reorderSport, setSportParent } from "./actions";
import { SportCreateForm } from "./sport-create-form";

type Row = {
  id: string;
  name: string;
  slug: string;
  category_type: string;
  display_order: number;
  status: string;
  parent_id: string | null;
};

const CT_LABEL: Record<string, string> = { sports: "スポーツ", outdoor: "アウトドア" };

export default async function SportsAdminPage() {
  await requireAdmin();
  const supabase = await createServerClient();
  const { data } = await supabase
    .schema(SCHEMA.core)
    .from("sports")
    .select("id, name, slug, category_type, display_order, status, parent_id")
    .order("category_type", { ascending: true })
    .order("display_order", { ascending: true });

  const sports = (data ?? []) as Row[];
  const parents = sports.filter((s) => !s.parent_id);
  const childrenOf = (pid: string) => sports.filter((s) => s.parent_id === pid);
  // 親が見つからない（孤立した）小分類も拾って表示する。
  const parentIds = new Set(parents.map((p) => p.id));
  const orphans = sports.filter((s) => s.parent_id && !parentIds.has(s.parent_id));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">カテゴリ管理（大分類・小分類）</h1>
      <p className="text-sm text-slate-500">
        大分類／小分類（2階層）で管理します。親（大分類）を選んで作成すると小分類になり、区分は親から継承します。
        公開停止・並び順・親の付け替えもここで変更できます（ハードコードしない）。
      </p>

      <SportCreateForm parents={parents.map((p) => ({ id: p.id, name: p.name }))} />

      {parents.length === 0 ? (
        <p className="text-slate-500">カテゴリがありません。まず大分類を追加してください。</p>
      ) : (
        <div className="space-y-3">
          {parents.map((p) => (
            <div key={p.id} className="card p-3">
              <SportRow node={p} parents={parents} />
              {childrenOf(p.id).length > 0 && (
                <div className="mt-2 space-y-2 border-l-2 border-slate-100 pl-3">
                  {childrenOf(p.id).map((c) => (
                    <SportRow key={c.id} node={c} parents={parents} child />
                  ))}
                </div>
              )}
            </div>
          ))}

          {orphans.length > 0 && (
            <div className="card p-3">
              <div className="mb-2 text-sm font-semibold text-amber-700">親が未設定/非公開の小分類</div>
              <div className="space-y-2">
                {orphans.map((c) => <SportRow key={c.id} node={c} parents={parents} child />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 1カテゴリの行。大分類は太字、小分類はインデント表示。並び順・公開状態・親の付け替えを操作できる。
function SportRow({ node, parents, child }: { node: Row; parents: Row[]; child?: boolean }) {
  const parentOptions = parents.filter((p) => p.id !== node.id);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className={child ? "text-slate-700" : "font-bold text-slate-900"}>
        {child ? "└ " : ""}{node.name}
      </span>
      <span className="text-slate-400">{node.slug}</span>
      <span className="badge bg-slate-100 text-slate-600">{child ? "小分類" : "大分類"}・{CT_LABEL[node.category_type] ?? node.category_type}</span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* 並び順 */}
        <form action={reorderSport} className="flex gap-1">
          <input type="hidden" name="id" value={node.id} />
          <input name="display_order" type="number" defaultValue={node.display_order} className="input max-w-[4.5rem]" title="表示順" />
          <button className="btn-outline" type="submit">↕</button>
        </form>

        {/* 親の付け替え（大分類化 or 別の大分類の小分類へ） */}
        <form action={setSportParent} className="flex gap-1">
          <input type="hidden" name="id" value={node.id} />
          <select name="parent_id" defaultValue={node.parent_id ?? ""} className="input max-w-[12rem]" title="親（大分類）">
            <option value="">大分類にする</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name} の小分類へ</option>
            ))}
          </select>
          <button className="btn-outline" type="submit">移動</button>
        </form>

        {/* 公開状態 */}
        <form action={toggleSportStatus}>
          <input type="hidden" name="id" value={node.id} />
          <input type="hidden" name="status" value={node.status === "published" ? "unpublished" : "published"} />
          <button className="btn-outline" type="submit">
            {node.status === "published" ? "公開中" : "停止中"}
          </button>
        </form>
      </div>
    </div>
  );
}
