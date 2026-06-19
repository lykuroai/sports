import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@spotomo/auth-client";
import { EVENT_STATUS_LABEL, formatDateTime } from "@spotomo/shared-types";

export default async function MyPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage");

  const { data: organized } = await supabase
    .schema("outdoor").from("events")
    .select("id, title, status, event_start_at")
    .eq("organizer_id", user.id)
    .is("deleted_at", null)
    .order("event_start_at", { ascending: false })
    .limit(50);

  type Row = { id: string; title: string; status: keyof typeof EVENT_STATUS_LABEL; event_start_at: string };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">マイページ（アウトドア）</h1>
      <section className="space-y-2">
        <h2 className="font-semibold">主催した募集</h2>
        {((organized ?? []) as Row[]).length === 0 ? (
          <p className="text-sm text-slate-400">まだありません。</p>
        ) : (
          ((organized ?? []) as Row[]).map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="card flex justify-between p-3 text-sm hover:shadow">
              <span>{e.title}</span>
              <span className="text-slate-400">{EVENT_STATUS_LABEL[e.status]}・{formatDateTime(e.event_start_at)}</span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
