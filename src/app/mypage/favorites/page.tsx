import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toggleFavorite } from "@/app/favorites/actions";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "お気に入り" };

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage/favorites");

  const { data: favorites } = await supabase
    .from("favorites")
    .select("id, target_type, target_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const byType = (t: string) => (favorites ?? []).filter((f) => f.target_type === t);
  const recIds = byType("recruitment").map((f) => f.target_id);
  const facIds = byType("facility").map((f) => f.target_id);
  const orgIds = byType("organizer").map((f) => f.target_id);

  const [recs, facs, orgs] = await Promise.all([
    recIds.length
      ? supabase.from("recruitments").select("id, title, event_start_at").in("id", recIds)
      : Promise.resolve({ data: [] as { id: string; title: string; event_start_at: string }[] }),
    facIds.length
      ? supabase.from("facilities").select("id, name, prefecture, city").in("id", facIds)
      : Promise.resolve({ data: [] as { id: string; name: string; prefecture: string | null; city: string | null }[] }),
    orgIds.length
      ? supabase.from("profiles").select("user_id, display_name, rating").in("user_id", orgIds)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string; rating: number }[] }),
  ]);

  function RemoveButton({ type, id }: { type: string; id: string }) {
    return (
      <form action={toggleFavorite}>
        <input type="hidden" name="target_type" value={type} />
        <input type="hidden" name="target_id" value={id} />
        <input type="hidden" name="path" value="/mypage/favorites" />
        <button className="text-xs text-slate-400 hover:text-red-600">解除</button>
      </form>
    );
  }

  const empty = (favorites ?? []).length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">お気に入り・フォロー</h1>
        <Link href="/mypage" className="text-sm text-brand hover:underline">← マイページ</Link>
      </div>

      {empty && <p className="card p-8 text-center text-slate-500">お気に入りはまだありません。</p>}

      {(recs.data ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 font-bold">募集</h2>
          <ul className="card divide-y divide-slate-100">
            {recs.data!.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <Link href={`/recruitments/${r.id}`} className="hover:text-brand">
                  <span className="font-medium">{r.title}</span>
                  <span className="ml-2 text-xs text-slate-400">{formatDateTime(r.event_start_at)}</span>
                </Link>
                <RemoveButton type="recruitment" id={r.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(facs.data ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 font-bold">施設</h2>
          <ul className="card divide-y divide-slate-100">
            {facs.data!.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-4 py-3">
                <Link href={`/facilities/${f.id}`} className="hover:text-brand">
                  <span className="font-medium">{f.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{f.prefecture ?? ""}{f.city ?? ""}</span>
                </Link>
                <RemoveButton type="facility" id={f.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(orgs.data ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 font-bold">フォロー中の主催者</h2>
          <ul className="card divide-y divide-slate-100">
            {orgs.data!.map((o) => (
              <li key={o.user_id} className="flex items-center justify-between px-4 py-3">
                <span>
                  <span className="font-medium">{o.display_name}</span>
                  <span className="ml-2 text-xs text-slate-400">評価 {o.rating.toFixed(1)}</span>
                </span>
                <RemoveButton type="organizer" id={o.user_id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
