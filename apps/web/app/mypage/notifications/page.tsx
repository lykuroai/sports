import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { formatDateTime } from "@spotomo/shared-types";
import { markNotificationRead, markAllNotificationsRead } from "./actions";

export const metadata = { title: "通知" };

// 通知一覧（mypage_design §14）。core.notifications を新しい順に表示。
export default async function NotificationsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage/notifications");

  const { data } = await supabase
    .schema(SCHEMA.core)
    .from("notifications")
    .select("id, notification_type, title, body, related_type, related_id, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  type Noti = {
    id: string; notification_type: string; title: string; body: string | null;
    related_type: string | null; related_id: string | null; read_at: string | null; created_at: string;
  };
  const notifications = (data ?? []) as Noti[];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // 関連先のリンクを推定（募集=recruitment / 大会=event / 施設=facility）。
  const linkOf = (n: Noti): string | null => {
    if (!n.related_id) return null;
    if (n.related_type?.includes("event") || n.related_type === "recruitment") return `/recruitments/${n.related_id}`;
    if (n.related_type === "facility") return `/facilities/${n.related_id}`;
    return null;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">通知{unreadCount > 0 && <span className="ml-2 text-base font-normal text-emerald-700">未読 {unreadCount}</span>}</h1>
        <Link href="/mypage" className="text-sm text-brand hover:underline">← マイページ</Link>
      </div>
      {unreadCount > 0 && (
        <form action={markAllNotificationsRead}>
          <button type="submit" className="btn-outline text-sm">すべて既読にする</button>
        </form>
      )}

      {notifications.length === 0 ? (
        <p className="text-slate-500">通知はまだありません。</p>
      ) : (
        <ul className="card divide-y">
          {notifications.map((n) => {
            const href = linkOf(n);
            const inner = (
              <div className={`p-4 ${n.read_at ? "" : "bg-emerald-50/50"}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{n.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDateTime(n.created_at)}</span>
                </div>
                {n.body && <p className="mt-1 text-sm text-slate-600">{n.body}</p>}
              </div>
            );
            return (
              <li key={n.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {href ? <Link href={href} className="block hover:bg-slate-50">{inner}</Link> : inner}
                </div>
                {!n.read_at && (
                  <form action={markNotificationRead} className="shrink-0 pr-3">
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="text-xs font-medium text-emerald-700 hover:underline">既読にする</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
