import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data } = await supabase.schema(SCHEMA.running).from("races").select("name").eq("id", id).maybeSingle();
  return { title: (data as { name: string } | null)?.name ?? "大会・イベント" };
}

// 大会・イベント詳細（画面遷移図 S010 /events/{id}）。running.races の1件を表示し、
// この大会に向けた仲間募集の作成・関連募集への導線を提供する。
export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data } = await supabase
    .schema(SCHEMA.running)
    .from("races")
    .select("id, name, prefecture, city, event_date, website_url, wikipedia_title, discontinued")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  type Race = {
    id: string; name: string; prefecture: string | null; city: string | null;
    event_date: string | null; website_url: string | null; wikipedia_title: string | null; discontinued: boolean;
  };
  const r = data as Race;

  // 同名キーワードの関連募集（この大会に向けた募集）。
  const { data: related } = await supabase
    .schema(SCHEMA.running).from("events")
    .select("id, title, prefecture, event_start_at")
    .ilike("title", `%${r.name}%`).is("deleted_at", null).limit(6);
  type Rel = { id: string; title: string; prefecture: string | null; event_start_at: string };
  const relatedEvents = (related ?? []) as Rel[];

  const createHref = `/recruitments/new?race=${encodeURIComponent(r.name)}${r.prefecture ? `&pref=${encodeURIComponent(r.prefecture)}` : ""}`;

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link href="/events" className="text-sm text-brand hover:underline">← 大会・イベント一覧</Link>

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="badge bg-brand/10 text-brand">大会・イベント</span>
          {r.discontinued && <span className="badge bg-slate-200 text-slate-600">終了</span>}
        </div>
        <h1 className="text-2xl font-bold">{r.name}</h1>
        <p className="text-sm text-slate-500">
          {[r.prefecture, r.city].filter(Boolean).join("") || "開催地は各大会の公式情報をご確認ください"}
        </p>
        {r.event_date && <p className="text-sm font-medium text-brand">開催日 {r.event_date}</p>}
      </header>

      <div className="flex flex-wrap gap-2">
        {!r.discontinued && (
          <Link href={createHref} className="btn-primary">この大会の仲間を募集する</Link>
        )}
        {r.website_url && (
          <a href={r.website_url} target="_blank" rel="noopener noreferrer" className="btn-outline">公式サイト ↗</a>
        )}
        {r.wikipedia_title && (
          <a href={`https://ja.wikipedia.org/wiki/${encodeURIComponent(r.wikipedia_title)}`} target="_blank" rel="noopener noreferrer" className="btn-outline">Wikipedia ↗</a>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">この大会に向けた仲間募集</h2>
        {relatedEvents.length === 0 ? (
          <p className="text-sm text-slate-500">関連する募集はまだありません。あなたが最初の募集を作成できます。</p>
        ) : (
          <ul className="card divide-y">
            {relatedEvents.map((e) => (
              <li key={e.id}>
                <Link href={`/recruitments/${e.id}`} className="block p-4 text-sm hover:bg-slate-50">
                  <span className="font-medium">{e.title}</span>
                  <span className="ml-2 text-slate-400">{e.prefecture}・{new Date(e.event_start_at).toLocaleDateString("ja-JP")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-400">
        大会データの出所: Wikipedia（CC BY-SA 4.0）/ Wikidata（CC0）。最新の開催可否・日程・募集要項は必ず各大会の公式情報をご確認ください。
      </p>
    </article>
  );
}
