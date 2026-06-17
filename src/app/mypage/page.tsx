import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RECRUITMENT_STATUS_LABEL, PARTICIPANT_STATUS_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "マイページ" };

export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage");

  const [{ data: profile }, { data: organized }, { data: joined }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("recruitments")
      .select("id, title, status, event_start_at")
      .eq("organizer_id", user.id)
      .is("deleted_at", null)
      .order("event_start_at", { ascending: false })
      .limit(20),
    supabase
      .from("recruitment_participants")
      .select("status, recruitments:recruitment_id ( id, title, event_start_at )")
      .eq("user_id", user.id)
      .order("applied_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-8">
      <section className="card flex items-center justify-between p-6">
        <div>
          <h1 className="text-xl font-bold">{profile?.display_name ?? "マイページ"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            参加 {profile?.participation_count ?? 0}回 / 主催 {profile?.organizer_count ?? 0}回 / 評価{" "}
            {(profile?.rating ?? 0).toFixed(1)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/mypage/favorites" className="btn-outline">お気に入り</Link>
          <Link href="/mypage/blocks" className="btn-outline">ブロック</Link>
          <Link href="/profile/edit" className="btn-outline">プロフィール編集</Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">主催した募集</h2>
          <Link href="/recruitments/new" className="text-sm text-brand hover:underline">＋ 新規作成</Link>
        </div>
        {(organized ?? []).length === 0 ? (
          <p className="card p-6 text-sm text-slate-500">まだ募集を作成していません。</p>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {organized!.map((r) => (
              <li key={r.id}>
                <Link href={`/recruitments/${r.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <span>
                    <span className="font-medium">{r.title}</span>
                    <span className="ml-2 text-xs text-slate-400">{formatDateTime(r.event_start_at)}</span>
                  </span>
                  <span className="badge bg-slate-100 text-slate-600">
                    {RECRUITMENT_STATUS_LABEL[r.status as keyof typeof RECRUITMENT_STATUS_LABEL]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">参加・申請した募集</h2>
        {(joined ?? []).length === 0 ? (
          <p className="card p-6 text-sm text-slate-500">まだ参加申請はありません。</p>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {joined!.map((j, i) => {
              // supabase の埋め込みは型上は配列だが、to-one FK は実体がオブジェクト
              const raw = (j as { recruitments: unknown }).recruitments;
              const rec = (Array.isArray(raw) ? raw[0] : raw) as
                | { id: string; title: string; event_start_at: string }
                | null;
              if (!rec) return null;
              return (
                <li key={i}>
                  <Link href={`/recruitments/${rec.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                    <span>
                      <span className="font-medium">{rec.title}</span>
                      <span className="ml-2 text-xs text-slate-400">{formatDateTime(rec.event_start_at)}</span>
                    </span>
                    <span className="badge bg-brand/10 text-brand">
                      {PARTICIPANT_STATUS_LABEL[j.status as keyof typeof PARTICIPANT_STATUS_LABEL]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
