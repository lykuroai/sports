import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { fetchMyParticipatingEvents } from "@spotomo/domain-common";
import { EventCard } from "@spotomo/shared-ui";

const DOMAIN = "running";

export default async function MyParticipationsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage/participations");

  const events = await fetchMyParticipatingEvents(supabase, DOMAIN, user.id);
  const { data: sportRows } = await supabase.schema(SCHEMA.core).from("sports").select("id, name");
  const sportName = new Map((sportRows ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/mypage" className="text-sm text-brand hover:underline">← マイページ</Link>
      <h1 className="text-2xl font-bold">私の参加</h1>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">参加申請中・参加予定の募集はありません。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => <EventCard key={e.id} event={e} sportLabel={sportName.get((e as { sport_id?: string }).sport_id ?? "") ?? "種目"} hrefBase="/recruitments" />)}
        </div>
      )}
    </div>
  );
}
