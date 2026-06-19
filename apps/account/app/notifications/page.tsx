import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { formatDateTime } from "@spotomo/shared-types";
import { markAllRead } from "./actions";

export default async function NotificationsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/notifications");

  const { data } = await supabase
    .schema(SCHEMA.core)
    .from("notifications")
    .select("id, title, body, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  type Row = { id: string; title: string; body: string | null; read_at: string | null; created_at: string };
  const notifications = (data ?? []) as Row[];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">通知</h1>
        <form action={markAllRead}>
          <button className="btn-outline" type="submit">すべて既読</button>
        </form>
      </div>

      {notifications.length === 0 ? (
        <p className="text-slate-500">通知はありません。</p>
      ) : (
        <ul className="card divide-y">
          {notifications.map((n) => (
            <li key={n.id} className={`p-4 ${n.read_at ? "" : "bg-brand/5"}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{n.title}</span>
                <span className="text-xs text-slate-400">{formatDateTime(n.created_at)}</span>
              </div>
              {n.body && <p className="mt-1 text-sm text-slate-600">{n.body}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-400">通知は全種目を横断して共通基盤(core.notifications)で管理します。</p>
    </div>
  );
}
