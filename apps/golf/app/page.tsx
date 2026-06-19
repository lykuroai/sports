import Link from "next/link";
import { createServerClient } from "@spotomo/auth-client";
import { EventCard } from "@spotomo/shared-ui";
import { fetchEvents } from "../lib/events";

export default async function GolfHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pref?: string; beginner?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();
  const events = await fetchEvents(supabase, {
    keyword: sp.q,
    prefecture: sp.pref,
    beginnerOnly: sp.beginner === "1",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ゴルフの仲間募集</h1>
        <Link href="/events/new" className="btn-primary">募集を作成</Link>
      </div>

      <form className="card flex flex-wrap gap-2 p-4" action="/">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="キーワード" className="input max-w-xs" />
        <input name="pref" defaultValue={sp.pref ?? ""} placeholder="都道府県" className="input max-w-[10rem]" />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="beginner" value="1" defaultChecked={sp.beginner === "1"} />
          初心者歓迎のみ
        </label>
        <button className="btn-outline" type="submit">検索</button>
      </form>

      {events.length === 0 ? (
        <p className="text-slate-500">条件に合う募集がありません。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((r) => (
            <EventCard key={r.id} event={r} sportLabel="ゴルフ" />
          ))}
        </div>
      )}
    </div>
  );
}
