import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import { fetchParticipants, fetchEventConditions } from "@spotomo/domain-common";
import { PARTICIPANT_STATUS_LABEL } from "@spotomo/shared-types";
import { approveAction, rejectAction } from "./actions";

const SCHEMA = "golf";

const GENDER_LABEL: Record<string, string> = {
  male: "男性",
  female: "女性",
  other: "その他",
  unspecified: "未指定",
};

export default async function ParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: errorMessage } = await searchParams;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/events/${id}/participants`);

  const { data: ev } = await supabase
    .schema(SCHEMA).from("events").select("organizer_id, title, capacity").eq("id", id).maybeSingle();
  if (!ev) notFound();
  if (ev.organizer_id !== user.id) redirect(`/events/${id}`);

  const [participants, conditions] = await Promise.all([
    fetchParticipants(supabase, SCHEMA, id),
    fetchEventConditions(supabase, SCHEMA, id),
  ]);
  const approved = participants.filter((p) => p.status === "approved").length;
  const isFull = approved >= ev.capacity;

  // 申請者の公開特性が募集条件に合致するかを判定（承認の判断材料）。
  const sportIdSet = new Set(conditions.condition_sport_ids);
  const matchGender = (g: string | null) =>
    conditions.gender_condition === "unspecified" ? null : g === conditions.gender_condition;
  const matchArea = (area: string | null) =>
    conditions.condition_prefectures.length === 0
      ? null
      : conditions.condition_prefectures.some((p) => (area ?? "").includes(p));
  const matchSports = (ids: string[]) =>
    sportIdSet.size === 0 ? null : ids.some((sid) => sportIdSet.has(sid));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">参加者管理（ゴルフ）</h1>
      <p className="text-sm text-slate-500">
        {ev.title}｜承認 {approved}/{ev.capacity}人
        {isFull && <span className="ml-2 badge bg-amber-100 text-amber-700">満員</span>}
      </p>

      {errorMessage && (
        <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{errorMessage}</p>
      )}

      {conditions.hasConditions && (
        <div className="card space-y-1 p-4 text-sm">
          <p className="font-semibold">希望する参加者条件</p>
          <ul className="text-slate-600">
            {conditions.gender_condition !== "unspecified" && (
              <li>性別：{GENDER_LABEL[conditions.gender_condition] ?? conditions.gender_condition}</li>
            )}
            {conditions.skill_level !== "any" && <li>スキル：{conditions.skill_level}</li>}
            {conditions.condition_prefectures.length > 0 && (
              <li>エリア：{conditions.condition_prefectures.join("・")}</li>
            )}
            {conditions.condition_sport_names.length > 0 && (
              <li>趣味・種目：{conditions.condition_sport_names.join("・")}</li>
            )}
          </ul>
          <p className="text-xs text-slate-400">
            条件はあくまで判断材料です。条件に合わない申請も承認できます。
          </p>
        </div>
      )}

      {participants.length === 0 ? (
        <p className="text-slate-500">まだ申請はありません。</p>
      ) : (
        <ul className="card divide-y">
          {participants.map((p) => (
            <li key={p.user_id} className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  <a
                    href={`${process.env.NEXT_PUBLIC_ACCOUNT_URL ?? ""}/users/${p.user_id}`}
                    className="hover:underline"
                  >
                    {p.nickname ?? "申請者"}
                  </a>
                  <span className="text-slate-500">（評価 {(p.rating ?? 0).toFixed(1)}）</span>
                </span>
                <span className="badge bg-slate-100 text-slate-600">
                  {PARTICIPANT_STATUS_LABEL[p.status as keyof typeof PARTICIPANT_STATUS_LABEL] ?? p.status}
                </span>
              </div>
              {conditions.hasConditions && (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {(() => {
                    const badge = (label: string, ok: boolean | null) => {
                      const cls =
                        ok == null
                          ? "bg-slate-100 text-slate-500"
                          : ok
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700";
                      return (
                        <span className={`rounded px-1.5 py-0.5 ${cls}`}>
                          {ok == null ? "" : ok ? "✓ " : "△ "}
                          {label}
                        </span>
                      );
                    };
                    return (
                      <>
                        {conditions.gender_condition !== "unspecified" &&
                          badge(`性別 ${GENDER_LABEL[p.gender ?? "unspecified"]}`, matchGender(p.gender))}
                        {conditions.condition_prefectures.length > 0 &&
                          badge(`エリア ${p.area ?? "未設定"}`, matchArea(p.area))}
                        {conditions.condition_sport_ids.length > 0 &&
                          badge("趣味・種目", matchSports(p.sport_ids))}
                        {p.age_range && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                            年代 {p.age_range}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              {p.application_message && <p className="text-sm text-slate-600">{p.application_message}</p>}
              {p.status === "applied" && (
                <div className="flex gap-2">
                  <form action={approveAction}>
                    <input type="hidden" name="event_id" value={id} />
                    <input type="hidden" name="applicant_id" value={p.user_id} />
                    <button className="btn-primary" type="submit" disabled={isFull} title={isFull ? "定員に達しています" : undefined}>承認</button>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="event_id" value={id} />
                    <input type="hidden" name="applicant_id" value={p.user_id} />
                    <button className="btn-outline" type="submit">拒否</button>
                  </form>
                </div>
              )}
              {(p.status === "approved" || p.status === "waitlist") && (
                <form action={rejectAction}>
                  <input type="hidden" name="event_id" value={id} />
                  <input type="hidden" name="applicant_id" value={p.user_id} />
                  <button className="btn-outline text-red-600" type="submit">参加を取り消す</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-400">承認時にグループチャットへ自動参加し、申請者へ通知します。</p>
    </div>
  );
}
