import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";
import { toggleSportStatus, reorderSport } from "./actions";
import { SportCreateForm } from "./sport-create-form";

export default async function SportsAdminPage() {
  await requireAdmin();
  const supabase = await createServerClient();
  const { data } = await supabase
    .schema(SCHEMA.core)
    .from("sports")
    .select("id, name, slug, category_type, display_order, status")
    .order("category_type", { ascending: true })
    .order("display_order", { ascending: true });

  type Row = {
    id: string; name: string; slug: string;
    category_type: string; display_order: number; status: string;
  };
  const sports = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">カテゴリ管理</h1>
      <p className="text-sm text-slate-500">
        カテゴリ・並び順・公開停止は管理画面から変更可能（ハードコードしない）。
      </p>

      <SportCreateForm />

      <table className="card w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr><th className="p-3">名称</th><th className="p-3">slug</th><th className="p-3">区分</th><th className="p-3">順</th><th className="p-3">状態</th></tr>
        </thead>
        <tbody>
          {sports.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="p-3">{s.name}</td>
              <td className="p-3 text-slate-400">{s.slug}</td>
              <td className="p-3">{s.category_type}</td>
              <td className="p-3">
                <form action={reorderSport} className="flex gap-1">
                  <input type="hidden" name="id" value={s.id} />
                  <input name="display_order" type="number" defaultValue={s.display_order} className="input max-w-[5rem]" />
                  <button className="btn-outline" type="submit">↕</button>
                </form>
              </td>
              <td className="p-3">
                <form action={toggleSportStatus}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="status" value={s.status === "published" ? "unpublished" : "published"} />
                  <button className="btn-outline" type="submit">
                    {s.status === "published" ? "公開中" : "停止中"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
