import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserReviewForm } from "@/components/user-review-form";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "相互評価" };

type Member = { user_id: string; display_name: string };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/recruitments/${id}/review`);

  const { data: r } = await supabase
    .from("recruitments")
    .select("id, title, organizer_id, event_start_at, status, profiles:organizer_id ( display_name )")
    .eq("id", id)
    .maybeSingle();
  if (!r) redirect("/recruitments");

  const isPast = new Date(r.event_start_at).getTime() < Date.now() || r.status === "finished";
  const isOrganizer = r.organizer_id === user.id;

  // 承認済み参加者
  const { data: approved } = await supabase
    .from("recruitment_participants")
    .select("user_id, status, profiles:user_id ( display_name )")
    .eq("recruitment_id", id)
    .in("status", ["approved", "attended"]);

  const iAmMember =
    isOrganizer || (approved ?? []).some((p) => p.user_id === user.id);

  if (!isPast || !iAmMember) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-xl font-bold">相互評価</h1>
        <p className="card p-8 text-center text-slate-500">
          {!iAmMember
            ? "この募集の参加者・主催者のみ評価できます。"
            : "開催終了後に相互評価ができます。"}
        </p>
        <Link href={`/recruitments/${id}`} className="mt-4 inline-block text-brand hover:underline">
          ← 募集詳細へ戻る
        </Link>
      </div>
    );
  }

  // 評価対象 = 自分以外のメンバー（主催者 + 承認済み参加者）
  const members: Member[] = [];
  if (!isOrganizer) {
    // @ts-expect-error supabase join 形状
    members.push({ user_id: r.organizer_id, display_name: r.profiles?.display_name ?? "主催者" });
  }
  for (const p of approved ?? []) {
    if (p.user_id === user.id) continue;
    members.push({
      user_id: p.user_id,
      // @ts-expect-error supabase join 形状
      display_name: p.profiles?.display_name ?? "利用者",
    });
  }

  // 自分が既に投稿したレビュー
  const { data: myReviews } = await supabase
    .from("user_reviews")
    .select("target_user_id, rating, review_tags, comment, visibility")
    .eq("recruitment_id", id)
    .eq("reviewer_id", user.id);
  const reviewByTarget = new Map(
    (myReviews ?? []).map((rv) => [rv.target_user_id, rv]),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">相互評価</h1>
        <p className="mt-1 text-sm text-slate-500">
          {r.title}（{formatDateTime(r.event_start_at)}）
        </p>
      </div>

      {members.length === 0 ? (
        <p className="card p-8 text-center text-slate-500">
          評価できる相手がいません。
        </p>
      ) : (
        <div className="space-y-4">
          {members.map((m) => (
            <UserReviewForm
              key={m.user_id}
              recruitmentId={id}
              targetUserId={m.user_id}
              targetName={m.display_name}
              existing={reviewByTarget.get(m.user_id) ?? null}
            />
          ))}
        </div>
      )}

      <Link href={`/recruitments/${id}`} className="inline-block text-brand hover:underline">
        ← 募集詳細へ戻る
      </Link>
    </div>
  );
}
