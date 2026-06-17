import { createClient } from "@/lib/supabase/server";
import { createSport, toggleSportStatus } from "../actions";

export default async function AdminSportsPage() {
  const supabase = await createClient();
  // 管理者は非公開カテゴリーも閲覧できる
  const { data: sports } = await supabase
    .from("sports")
    .select("id, name, slug, category_type, status, display_order")
    .order("category_type")
    .order("display_order");

  const groups = {
    sports: (sports ?? []).filter((s) => s.category_type === "sports"),
    outdoor: (sports ?? []).filter((s) => s.category_type === "outdoor"),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">カテゴリー管理</h1>
      <p className="text-sm text-slate-500">
        カテゴリーの公開停止・追加ができます（仕様 §5 / §15.10）。公開停止すると検索・募集作成の選択肢から外れます。
      </p>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">カテゴリーを追加</h2>
        <form action={createSport} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="name">名称</label>
            <input id="name" name="name" className="input" required placeholder="例: スカッシュ" />
          </div>
          <div>
            <label className="label" htmlFor="slug">slug</label>
            <input id="slug" name="slug" className="input" required placeholder="squash" />
          </div>
          <div>
            <label className="label" htmlFor="category_type">区分</label>
            <select id="category_type" name="category_type" className="input" defaultValue="sports">
              <option value="sports">スポーツ・レジャー</option>
              <option value="outdoor">アウトドア・レジャー</option>
            </select>
          </div>
          <button className="btn-primary">追加</button>
        </form>
      </section>

      {(["sports", "outdoor"] as const).map((cat) => (
        <section key={cat}>
          <h2 className="mb-2 font-semibold">
            {cat === "sports" ? "スポーツ・レジャー" : "アウトドア・レジャー"}
          </h2>
          <ul className="card divide-y divide-slate-100">
            {groups[cat].map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  {s.name}
                  <span className="ml-2 text-xs text-slate-400">{s.slug}</span>
                  {s.status === "unpublished" && (
                    <span className="badge ml-2 bg-slate-200 text-slate-500">公開停止中</span>
                  )}
                </span>
                <form action={toggleSportStatus}>
                  <input type="hidden" name="sport_id" value={s.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={s.status === "published" ? "unpublished" : "published"}
                  />
                  <button className="btn-outline px-3 py-1 text-xs">
                    {s.status === "published" ? "公開停止" : "公開する"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
