import { createServerClient, SCHEMA } from "@spotomo/auth-client";

/**
 * 未読通知バッジ（サーバーコンポーネント）。core.notifications の未読件数を表示。
 * ※ barrel(index) からは export せず、サブパス "@spotomo/shared-ui/notification-bell"
 *   から読むこと（next/headers を含むためクライアントバンドルに混ぜない）。
 */
export async function NotificationBell({ accountUrl = "" }: { accountUrl?: string }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { count } = await supabase
    .schema(SCHEMA.core)
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return (
    <a href={`${accountUrl}/notifications`} className="relative hover:text-brand" aria-label="通知">
      🔔
      {count ? (
        <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1 text-[10px] text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </a>
  );
}
