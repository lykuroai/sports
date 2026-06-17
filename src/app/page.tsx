import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RecruitmentCard, type RecruitmentListItem } from "@/components/recruitment-card";
import { fetchRecruitments } from "@/lib/recruitments";

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: sports }, recruitments] = await Promise.all([
    supabase
      .from("sports")
      .select("id, name, slug, category_type")
      .eq("status", "published")
      .order("display_order")
      .limit(12),
    fetchRecruitments(supabase, { limit: 6, sort: "soon" }),
  ]);

  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark px-8 py-14 text-white">
        <h1 className="text-3xl font-bold leading-snug">
          スポーツ・レジャーの
          <br />
          仲間を見つけよう
        </h1>
        <p className="mt-4 max-w-lg text-white/90">
          やりたい種目・地域・日時から募集を探して参加。自分で募集を立てて仲間を集めることもできます。
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/recruitments" className="btn bg-white text-brand hover:bg-slate-100">
            募集を探す
          </Link>
          <Link href="/recruitments/new" className="btn border border-white/60 text-white hover:bg-white/10">
            募集を作成する
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">種目から探す</h2>
        <div className="flex flex-wrap gap-2">
          {(sports ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/recruitments?sport=${s.slug}`}
              className="btn-outline"
            >
              {s.name}
            </Link>
          ))}
          <Link href="/recruitments" className="btn-outline text-brand">
            すべて見る →
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">開催が近い募集</h2>
          <Link href="/recruitments" className="text-sm text-brand hover:underline">
            もっと見る →
          </Link>
        </div>
        {recruitments.length === 0 ? (
          <p className="text-slate-500">現在公開中の募集はありません。</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {recruitments.map((r: RecruitmentListItem) => (
              <RecruitmentCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
