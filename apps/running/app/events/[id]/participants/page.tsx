import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import { fetchParticipants } from "@spotomo/domain-common";
import { PARTICIPANT_STATUS_LABEL } from "@spotomo/shared-types";
import { approveAction, rejectAction } from "./actions";

const SCHEMA = "running";

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/events/${id}/participants`);

  const { data: ev } = await supabase
    .schema(SCHEMA).from("events").select("organizer_id, title, capacity").eq("id", id).maybeSingle();
  if (!ev) notFound();
  if (ev.organizer_id !== user.id) redirect(`/events/${id}`);

  const participants = await fetchParticipants(supabase, SCHEMA, id);
  const approved = participants.filter((p) => p.status === "approved").length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">参加者管理（ランニング）</h1>
      <p className="text-sm text-slate-500">{ev.title}｜承認 {approved}/{ev.capacity}人</p>

      {participants.length === 0 ? (
        <p className="text-slate-500">まだ申請はありません。</p>
      ) : (
        <ul className="card divide-y">
          {participants.map((p) => (
            <li key={p.user_id} className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.nickname ?? "申請者"}（評価 {(p.rating ?? 0).toFixed(1)}）</span>
                <span className="badge bg-slate-100 text-slate-600">
                  {PARTICIPANT_STATUS_LABEL[p.status as keyof typeof PARTICIPANT_STATUS_LABEL] ?? p.status}
                </span>
              </div>
              {p.application_message && <p className="text-sm text-slate-600">{p.application_message}</p>}
              {p.status === "applied" && (
                <div className="flex gap-2">
                  <form action={approveAction}>
                    <input type="hidden" name="event_id" value={id} />
                    <input type="hidden" name="applicant_id" value={p.user_id} />
                    <button className="btn-primary" type="submit">承認</button>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="event_id" value={id} />
                    <input type="hidden" name="applicant_id" value={p.user_id} />
                    <button className="btn-outline" type="submit">拒否</button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-400">承認時にグループチャットへ自動参加し、申請者へ通知します。</p>
    </div>
  );
}
