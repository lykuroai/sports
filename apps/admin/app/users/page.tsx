import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";
import { suspendUser } from "../actions";

export default async function UsersPage() {
  await requireAdmin();
  const supabase = await createServerClient();
  const { data } = await supabase
    .schema(SCHEMA.account).from("users")
    .select("id, email, status, created_at")
    .order("created_at", { ascending: false }).limit(100);

  type Row = { id: string; email: string | null; status: string; created_at: string };
  const users = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">利用者管理</h1>
      <table className="card w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr><th className="p-3">メール</th><th className="p-3">状態</th><th className="p-3">操作</th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-3">{u.email ?? "-"}</td>
              <td className="p-3">{u.status}</td>
              <td className="p-3">
                <form action={suspendUser} className="flex gap-2">
                  <input type="hidden" name="user_id" value={u.id} />
                  <input type="hidden" name="status" value={u.status === "active" ? "suspended" : "active"} />
                  <button className="btn-outline" type="submit">
                    {u.status === "active" ? "停止" : "復帰"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-400">停止/復帰はサービスロールで実行し audit_logs に記録します。</p>
    </div>
  );
}
