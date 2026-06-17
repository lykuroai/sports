import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markAllRead, markRead } from "./actions";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "通知" };

// related_type → リンク先
function linkFor(type: string | null, id: string | null): string | null {
  if (!id) return null;
  if (type === "recruitment") return `/recruitments/${id}`;
  if (type === "facility_submission") return `/mypage`;
  return null;
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/notifications");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const hasUnread = (notifications ?? []).some((n) => !n.read_at);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">通知</h1>
        {hasUnread && (
          <form action={markAllRead}>
            <button className="btn-outline px-3 py-1 text-xs">すべて既読にする</button>
          </form>
        )}
      </div>

      {(notifications ?? []).length === 0 ? (
        <p className="card p-8 text-center text-slate-500">通知はありません。</p>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {notifications!.map((n) => {
            const href = linkFor(n.related_type, n.related_id);
            const inner = (
              <div className="flex items-start gap-3 px-4 py-3">
                {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                <div className={n.read_at ? "text-slate-500" : ""}>
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(n.created_at)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id} className="flex items-center justify-between">
                {href ? (
                  <Link href={href} className="grow hover:bg-slate-50">{inner}</Link>
                ) : (
                  <div className="grow">{inner}</div>
                )}
                {!n.read_at && (
                  <form action={markRead} className="px-3">
                    <input type="hidden" name="notification_id" value={n.id} />
                    <button className="text-xs text-slate-400 hover:text-brand">既読</button>
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
