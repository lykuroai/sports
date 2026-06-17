import { createClient } from "@/lib/supabase/server";
import { setUserStatus } from "../actions";
import { formatDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  active: "有効",
  suspended: "一時停止",
  banned: "永久停止",
  withdrawn: "退会",
};

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // users と profiles を結合（管理者は users を閲覧可）
  const { data: users } = await supabase
    .from("users")
    .select("id, email, status, created_at, profiles:id ( display_name )")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">利用者管理</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="p-3">表示名</th>
              <th className="p-3">メール</th>
              <th className="p-3">状態</th>
              <th className="p-3">登録日</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => {
              // @ts-expect-error supabase join 形状
              const name = u.profiles?.display_name ?? "—";
              return (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="p-3 font-medium">{name}</td>
                  <td className="p-3 text-slate-500">{u.email ?? "—"}</td>
                  <td className="p-3">
                    <span className={`badge ${u.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {STATUS_LABEL[u.status] ?? u.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">{formatDateTime(u.created_at)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {u.status !== "active" && (
                        <StatusButton userId={u.id} status="active" label="復帰" className="btn-outline" />
                      )}
                      {u.status === "active" && (
                        <StatusButton userId={u.id} status="suspended" label="一時停止" className="btn-outline text-amber-600" />
                      )}
                      {u.status !== "banned" && (
                        <StatusButton userId={u.id} status="banned" label="永久停止" className="btn-outline text-red-600" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusButton({
  userId,
  status,
  label,
  className,
}: {
  userId: string;
  status: string;
  label: string;
  className: string;
}) {
  return (
    <form action={setUserStatus}>
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="status" value={status} />
      <button className={`${className} px-3 py-1 text-xs`}>{label}</button>
    </form>
  );
}
