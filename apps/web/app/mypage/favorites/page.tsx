import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@spotomo/auth-client";
import { fetchFavoriteEvents } from "@spotomo/domain-common";
import { EventCard } from "@spotomo/shared-ui";

const DOMAIN = "running";

export default async function MyFavoritesPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage/favorites");

  const events = await fetchFavoriteEvents(supabase, DOMAIN, user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/mypage" className="text-sm text-brand hover:underline">← マイページ</Link>
      <h1 className="text-2xl font-bold">お気に入り</h1>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">お気に入りした募集はありません。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => <EventCard key={e.id} event={e} sportLabel="ランニング" />)}
        </div>
      )}
    </div>
  );
}
