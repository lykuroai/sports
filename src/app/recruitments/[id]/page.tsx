import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchRecruitmentDetail } from "@/lib/recruitments";
import { ApplyForm } from "@/components/apply-form";
import { ReportForm } from "@/components/report-form";
import { FavoriteButton } from "@/components/favorite-button";
import { toggleBlock } from "@/app/blocks/actions";
import { cancelParticipation, decideApplication } from "../actions";
import { finishRecruitment } from "./review/actions";
import {
  APPROVAL_TYPE_LABEL,
  GENDER_LABEL,
  PARTICIPANT_STATUS_LABEL,
  RECRUITMENT_STATUS_LABEL,
  SKILL_LEVEL_LABEL,
} from "@/lib/constants";
import { formatDateTime, formatFee } from "@/lib/format";

export default async function RecruitmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const r = await fetchRecruitmentDetail(supabase, id);
  if (!r) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOrganizer = user?.id === r.organizer_id;

  // 自分の参加状態
  let myStatus: string | null = null;
  if (user && !isOrganizer) {
    const { data } = await supabase
      .from("recruitment_participants")
      .select("status")
      .eq("recruitment_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    myStatus = data?.status ?? null;
  }

  // 主催者向け: 参加者一覧（プロフィール名のみ。連絡先は出さない）
  let participants:
    | { user_id: string; status: string; application_message: string | null; display_name: string }[]
    | null = null;
  if (isOrganizer) {
    const { data } = await supabase
      .from("recruitment_participants")
      .select("user_id, status, application_message, profiles:user_id ( display_name )")
      .eq("recruitment_id", id)
      .order("applied_at");
    participants =
      (data ?? []).map((p) => ({
        user_id: p.user_id,
        status: p.status,
        application_message: p.application_message,
        // @ts-expect-error supabase join 形状
        display_name: p.profiles?.display_name ?? "利用者",
      })) ?? [];
  }

  // お気に入り／主催者フォロー状態
  let favRecruitment = false;
  let followOrganizer = false;
  if (user) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("target_type, target_id")
      .eq("user_id", user.id)
      .in("target_id", [id, r.organizer_id]);
    favRecruitment = (favs ?? []).some((f) => f.target_type === "recruitment" && f.target_id === id);
    followOrganizer = (favs ?? []).some((f) => f.target_type === "organizer" && f.target_id === r.organizer_id);
  }

  // 主催者をブロック済みか（自分が作成したブロック行は RLS で読める）
  let blockedOrganizer = false;
  if (user && !isOrganizer) {
    const { data: b } = await supabase
      .from("blocks")
      .select("blocked_user_id")
      .eq("blocker_user_id", user.id)
      .eq("blocked_user_id", r.organizer_id)
      .maybeSingle();
    blockedOrganizer = !!b;
  }

  const canApply =
    user && !isOrganizer && ["open", "few_left"].includes(r.status) &&
    (myStatus === null || myStatus === "cancelled_self" || myStatus === "rejected");

  // 開催終了後の評価導線
  const isPast = new Date(r.event_start_at).getTime() < Date.now() || r.status === "finished";
  const isMember = isOrganizer || myStatus === "approved" || myStatus === "attended";
  const canReview = isPast && isMember;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <article className="space-y-6">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="badge bg-emerald-100 text-emerald-700">
              {RECRUITMENT_STATUS_LABEL[r.status]}
            </span>
            {r.sports && <span className="badge bg-brand/10 text-brand">{r.sports.name}</span>}
            {r.beginner_allowed && <span className="badge bg-sky-100 text-sky-700">初心者歓迎</span>}
          </div>
          <h1 className="text-2xl font-bold">{r.title}</h1>
        </div>

        <section className="card divide-y divide-slate-100">
          <Row label="開催日時" value={formatDateTime(r.event_start_at)} />
          {r.event_end_at && <Row label="終了予定" value={formatDateTime(r.event_end_at)} />}
          <Row
            label="開催場所"
            value={`${r.prefecture ?? ""}${r.city ?? ""}${
              r.facilities ? `・${r.facilities.name}` : "・施設未定（参加者と相談）"
            }`}
          />
          {r.meeting_place && <Row label="集合場所" value={r.meeting_place} />}
          <Row label="参加費" value={formatFee(r.participation_fee)} />
          <Row label="定員" value={`${r.approved_count} / ${r.capacity}人`} />
          <Row label="経験レベル" value={SKILL_LEVEL_LABEL[r.skill_level]} />
          <Row label="性別条件" value={GENDER_LABEL[r.gender_condition]} />
          <Row label="参加方式" value={APPROVAL_TYPE_LABEL[r.approval_type]} />
          {r.application_deadline && (
            <Row label="募集締切" value={formatDateTime(r.application_deadline)} />
          )}
          {r.rain_policy && <Row label="雨天時" value={r.rain_policy} />}
          {r.cancellation_policy && <Row label="キャンセル規定" value={r.cancellation_policy} />}
        </section>

        {r.description && (
          <section className="card p-5">
            <h2 className="mb-2 font-bold">募集の説明</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{r.description}</p>
          </section>
        )}

        {isOrganizer && participants && (
          <section className="card p-5">
            <h2 className="mb-3 font-bold">参加申請の管理（{participants.length}件）</h2>
            {participants.length === 0 ? (
              <p className="text-sm text-slate-500">まだ申請はありません。</p>
            ) : (
              <ul className="space-y-3">
                {participants.map((p) => (
                  <li key={p.user_id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <p className="font-medium">{p.display_name}</p>
                      <span className="badge bg-slate-100 text-slate-600">
                        {PARTICIPANT_STATUS_LABEL[p.status as keyof typeof PARTICIPANT_STATUS_LABEL]}
                      </span>
                      {p.application_message && (
                        <p className="mt-1 text-sm text-slate-600">{p.application_message}</p>
                      )}
                    </div>
                    {p.status === "applied" && (
                      <div className="flex shrink-0 gap-2">
                        <form action={decideApplication}>
                          <input type="hidden" name="recruitment_id" value={id} />
                          <input type="hidden" name="user_id" value={p.user_id} />
                          <input type="hidden" name="decision" value="approve" />
                          <button className="btn-primary px-3 py-1 text-xs">承認</button>
                        </form>
                        <form action={decideApplication}>
                          <input type="hidden" name="recruitment_id" value={id} />
                          <input type="hidden" name="user_id" value={p.user_id} />
                          <input type="hidden" name="decision" value="reject" />
                          <button className="btn-outline px-3 py-1 text-xs">見送る</button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </article>

      {/* サイドバー: 参加アクション */}
      <aside className="space-y-4">
        <div className="card p-5">
          {r.profiles && (
            <p className="mb-4 text-sm text-slate-600">
              主催: <span className="font-medium text-slate-800">{r.profiles.display_name}</span>
              <br />
              評価 {r.profiles.rating.toFixed(1)}
            </p>
          )}

          {!user && (
            <Link href={`/login?redirect=/recruitments/${id}`} className="btn-primary w-full">
              ログインして参加申請
            </Link>
          )}

          {isOrganizer && (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">あなたが主催する募集です。</p>
              <Link href={`/chat/${id}`} className="btn-outline w-full">グループチャット</Link>
              {isPast && r.status !== "finished" && (
                <form action={finishRecruitment}>
                  <input type="hidden" name="recruitment_id" value={id} />
                  <button className="btn-primary w-full">開催を終了して評価する</button>
                </form>
              )}
              {r.status === "finished" && (
                <Link href={`/recruitments/${id}/review`} className="btn-primary w-full">
                  参加者を評価する
                </Link>
              )}
            </div>
          )}

          {user && !isOrganizer && myStatus && (
            <div className="space-y-3">
              <p className="text-sm">
                現在の状態:{" "}
                <span className="font-medium">
                  {PARTICIPANT_STATUS_LABEL[myStatus as keyof typeof PARTICIPANT_STATUS_LABEL]}
                </span>
              </p>
              {myStatus === "approved" && (
                <Link href={`/chat/${id}`} className="btn-outline w-full">グループチャット</Link>
              )}
              {canReview && (
                <Link href={`/recruitments/${id}/review`} className="btn-primary w-full">
                  主催者・参加者を評価する
                </Link>
              )}
              {["applied", "approved", "waitlist"].includes(myStatus) && (
                <form action={cancelParticipation}>
                  <input type="hidden" name="recruitment_id" value={id} />
                  <button className="btn-outline w-full text-red-600">参加をキャンセル</button>
                </form>
              )}
            </div>
          )}

          {canApply && <ApplyForm recruitmentId={id} />}

          {user && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <FavoriteButton
                targetType="recruitment"
                targetId={id}
                active={favRecruitment}
                path={`/recruitments/${id}`}
              />
              {!isOrganizer && (
                <FavoriteButton
                  targetType="organizer"
                  targetId={r.organizer_id}
                  active={followOrganizer}
                  path={`/recruitments/${id}`}
                  labelOn="フォロー中"
                  labelOff="主催者をフォロー"
                />
              )}
            </div>
          )}

          {user && !isOrganizer && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <ReportForm targetType="recruitment" targetId={id} />
              <form action={toggleBlock}>
                <input type="hidden" name="blocked_user_id" value={r.organizer_id} />
                <input type="hidden" name="path" value={`/recruitments/${id}`} />
                <button className="text-sm text-slate-400 hover:text-red-600">
                  {blockedOrganizer ? "主催者のブロックを解除" : "主催者をブロック"}
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-5 py-3 text-sm">
      <dt className="w-24 shrink-0 text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}
