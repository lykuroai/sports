import { notFound } from "next/navigation";
import {
  EVENT_STATUS_LABEL,
  SKILL_LEVEL_LABEL,
  GOLF_RESERVATION_STATUS_LABEL,
  formatDateTime,
  formatFee,
} from "@spotomo/shared-types";
import type { EventGolfDetails, GolfCourse, GolfPlan, GolfReservationStatus } from "@spotomo/shared-types";
import { createServerClient, getUser, loginUrlFor } from "@spotomo/auth-client";
import { isFavorited, isFollowing, fetchEventMembers } from "@spotomo/domain-common";
import { fetchEventDetail, isApplyable } from "../../../lib/events";
import { applyToEvent, updateReservationStatus } from "../actions";
import { FavoriteButton } from "../favorite-button";
import { FollowButton } from "../follow-button";
import { EventMembers } from "./event-members";
import { cancelAction } from "./participants/actions";

const SCHEMA = "golf";

const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "";

const STATUS_OPTIONS: GolfReservationStatus[] = [
  "planning",
  "reserved_external",
  "changed_external",
  "cancelled_external",
  "unknown",
];

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const ev = await fetchEventDetail(supabase, id);
  if (!ev) notFound();

  const user = await getUser();
  const isOrganizer = user?.id === ev.organizer_id;
  // 未ログインで参加申請する場合は account 共通ログインへ誘導し、認証後この募集詳細へ戻す。
  const loginHref = user ? "" : await loginUrlFor(`/events/${ev.id}`);

  // 楽天GORA 連携情報（紐づくゴルフ場・プラン・予約状態）。
  const { data: detailRow } = await supabase
    .schema(SCHEMA).from("event_golf_details").select("*").eq("event_id", ev.id).maybeSingle();
  const golfDetails = (detailRow as EventGolfDetails | null) ?? null;
  let golfPlan: GolfPlan | null = null;
  let golfCourse: GolfCourse | null = null;
  if (golfDetails) {
    const [{ data: planRow }, { data: courseRow }] = await Promise.all([
      golfDetails.golf_plan_id
        ? supabase.schema(SCHEMA).from("golf_plans").select("*").eq("id", golfDetails.golf_plan_id).maybeSingle()
        : Promise.resolve({ data: null }),
      golfDetails.golf_course_id
        ? supabase.schema(SCHEMA).from("golf_courses").select("*").eq("id", golfDetails.golf_course_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    golfPlan = (planRow as GolfPlan | null) ?? null;
    golfCourse = (courseRow as GolfCourse | null) ?? null;
  }
  const isPast = ev.status === "finished" || new Date(ev.event_start_at) < new Date();

  let fav = false;
  let following = false;
  let partStatus: string | null = null;
  if (user) {
    fav = await isFavorited(supabase, { userId: user.id, targetType: "recruitment", targetId: ev.id });
    if (!isOrganizer) {
      following = await isFollowing(supabase, { followerId: user.id, followeeId: ev.organizer_id });
      const { data: part } = await supabase
        .schema(SCHEMA).from("event_participants")
        .select("status").eq("event_id", ev.id).eq("user_id", user.id).maybeSingle();
      partStatus = (part?.status as string | undefined) ?? null;
    }
  }
  const isMember = isOrganizer || partStatus === "approved";
  const canCancel = partStatus === "applied" || partStatus === "approved" || partStatus === "waitlist";

  // メンバー一覧は承認済みメンバー（発起者・承認済み参加者）にのみ表示する。
  const members = isMember && user ? await fetchEventMembers(supabase, SCHEMA, ev.id) : [];

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="badge bg-brand/10 text-brand">ゴルフ</span>
          <span className="badge bg-slate-100 text-slate-600">{EVENT_STATUS_LABEL[ev.status]}</span>
        </div>
        <h1 className="text-2xl font-bold">{ev.title}</h1>
        {ev.organizer_nickname && (
          <p className="text-sm text-slate-500">
            主催: {ev.organizer_nickname}（評価 {(ev.organizer_rating ?? 0).toFixed(1)}）
          </p>
        )}
      </header>

      {user && (
        <div className="flex flex-wrap gap-2">
          <FavoriteButton eventId={ev.id} initial={fav} />
          {!isOrganizer && <FollowButton organizerId={ev.organizer_id} initial={following} />}
          {isOrganizer && (
            <>
              <a href={`/events/${ev.id}/participants`} className="btn-outline">参加者管理</a>
              <a href={`/events/${ev.id}/edit`} className="btn-outline">募集を修正</a>
            </>
          )}
          {isMember && isPast && (
            <a href={`/events/${ev.id}/review`} className="btn-outline">相互評価する</a>
          )}
        </div>
      )}

      <dl className="card grid grid-cols-[6rem_1fr] gap-y-3 p-5 text-sm">
        <dt className="text-slate-400">日時</dt><dd>{formatDateTime(ev.event_start_at)}</dd>
        <dt className="text-slate-400">場所</dt>
        <dd>{ev.prefecture}{ev.city}{ev.facility_name ? `・${ev.facility_name}` : "・施設未定"}</dd>
        <dt className="text-slate-400">参加費</dt><dd>{formatFee(ev.participation_fee)}</dd>
        <dt className="text-slate-400">定員</dt><dd>{ev.approved_count}/{ev.capacity}人</dd>
        <dt className="text-slate-400">レベル</dt><dd>{SKILL_LEVEL_LABEL[ev.skill_level]}</dd>
      </dl>

      {ev.description && <p className="whitespace-pre-wrap text-sm text-slate-700">{ev.description}</p>}

      {golfDetails && (golfCourse || golfPlan) && (
        <section className="card space-y-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">ゴルフ場・プラン（楽天GORA）</h2>
            <span className="badge bg-slate-100 text-slate-600">
              {GOLF_RESERVATION_STATUS_LABEL[golfDetails.reservation_status]}
            </span>
          </div>

          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
            {golfCourse && (
              <>
                <dt className="text-slate-400">ゴルフ場</dt>
                <dd>{golfCourse.golf_course_name}</dd>
                {(golfCourse.prefecture || golfCourse.address) && (
                  <>
                    <dt className="text-slate-400">住所</dt>
                    <dd>{golfCourse.prefecture ?? ""}{golfCourse.address ?? ""}</dd>
                  </>
                )}
              </>
            )}
            {golfPlan && (
              <>
                <dt className="text-slate-400">プラン</dt>
                <dd>{golfPlan.plan_name ?? "—"}</dd>
                <dt className="text-slate-400">プレー日</dt>
                <dd>{golfPlan.play_date ?? "—"}{golfPlan.start_time_zone ? `・${golfPlan.start_time_zone}` : ""}</dd>
                {golfPlan.price != null && (
                  <>
                    <dt className="text-slate-400">料金</dt>
                    <dd>{golfPlan.price.toLocaleString()}円 / 1名</dd>
                  </>
                )}
              </>
            )}
          </dl>

          {golfDetails.external_reservation_note && (
            <p className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-sm text-slate-600">
              {golfDetails.external_reservation_note}
            </p>
          )}

          {golfPlan?.reserve_url && (
            <a href={golfPlan.reserve_url} target="_blank" rel="noopener noreferrer" className="btn-primary inline-block">
              楽天GORAで予約する ↗
            </a>
          )}

          {isOrganizer && (
            <form action={updateReservationStatus} className="space-y-2 border-t pt-3">
              <input type="hidden" name="event_id" value={ev.id} />
              <p className="text-sm font-medium">予約状態を更新（楽天GORAで予約後に反映）</p>
              <select name="reservation_status" className="input max-w-[16rem]" defaultValue={golfDetails.reservation_status}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{GOLF_RESERVATION_STATUS_LABEL[s]}</option>
                ))}
              </select>
              <textarea
                name="external_reservation_note"
                className="input"
                rows={2}
                placeholder="予約メモ（予約番号・集合時間など）"
                defaultValue={golfDetails.external_reservation_note ?? ""}
              />
              <button className="btn-outline" type="submit">予約状態を更新</button>
            </form>
          )}

          <p className="text-xs text-slate-400">
            ゴルフ場・プラン情報は楽天GORAから取得しています。料金・空き枠は変更される場合があります。
            予約確定は楽天GORAの予約ページで行ってください。キャンセル規定は楽天GORAおよびゴルフ場の条件に従います。
          </p>
        </section>
      )}

      {isMember && user && (
        <EventMembers members={members} viewerId={user.id} accountUrl={ACCOUNT_URL} />
      )}

      {isOrganizer ? (
        <div className="card p-4 text-sm text-slate-600">
          あなたが主催する募集です。<a href={`/chat/${ev.id}`} className="text-brand hover:underline">グループチャット</a>・
          <a href={`/events/${ev.id}/participants`} className="text-brand hover:underline">参加者管理</a>で運営できます。
        </div>
      ) : canCancel ? (
        <div className="card space-y-2 p-4 text-sm">
          <p>現在のステータス: <span className="font-medium">{partStatus === "approved" ? "参加承認済み" : "申請中"}</span></p>
          {partStatus === "approved" && (
            <a href={`/chat/${ev.id}`} className="text-brand hover:underline">グループチャットを開く</a>
          )}
          <form action={cancelAction}>
            <input type="hidden" name="event_id" value={ev.id} />
            <button className="btn-outline" type="submit">参加をキャンセル</button>
          </form>
        </div>
      ) : isApplyable(ev.status) ? (
        user ? (
          <form action={applyToEvent} className="card space-y-3 p-4">
            <input type="hidden" name="event_id" value={ev.id} />
            <label className="label" htmlFor="msg">参加メッセージ（任意）</label>
            <textarea id="msg" name="application_message" className="input" rows={3} />
            <button className="btn-primary" type="submit">この募集に参加申請する</button>
            <p className="text-xs text-slate-400">
              連絡先（メール・電話・本名）は主催者にも公開されません。
            </p>
          </form>
        ) : (
          <a href={loginHref} className="btn-primary block text-center">
            ログインして参加申請する
          </a>
        )
      ) : (
        <p className="text-sm text-slate-500">現在この募集は参加申請を受け付けていません。</p>
      )}
    </article>
  );
}
