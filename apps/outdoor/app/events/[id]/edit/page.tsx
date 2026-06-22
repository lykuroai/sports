import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import { isPremium, fetchPublishedSports } from "@spotomo/domain-common";
import EditEventForm, { type EventInit } from "./edit-event-form";

const SCHEMA = "outdoor";

function toLocalInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/events/${id}/edit`);

  const { data: ev } = await supabase
    .schema(SCHEMA)
    .from("events")
    .select(
      "id, organizer_id, title, description, prefecture, city, event_start_at, capacity, participation_fee, beginner_allowed, approval_type, gender_condition, skill_level, condition_prefectures, condition_sport_ids, activity_type, deleted_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!ev || ev.deleted_at) notFound();
  if (ev.organizer_id !== user.id) redirect(`/events/${id}`);

  const [premium, sports, { count }] = await Promise.all([
    isPremium(supabase, user.id),
    fetchPublishedSports(supabase),
    supabase
      .schema(SCHEMA)
      .from("event_participants")
      .select("user_id", { count: "exact", head: true })
      .eq("event_id", id)
      .in("status", ["applied", "approved", "waitlist"]),
  ]);
  const hasApplicants = (count ?? 0) > 0;

  const event: EventInit = {
    id: ev.id,
    title: ev.title,
    description: ev.description,
    prefecture: ev.prefecture,
    city: ev.city,
    event_start_at_local: toLocalInput(ev.event_start_at),
    capacity: ev.capacity,
    participation_fee: ev.participation_fee,
    beginner_allowed: ev.beginner_allowed,
    approval_type: ev.approval_type,
    gender_condition: ev.gender_condition ?? "unspecified",
    skill_level: ev.skill_level ?? "any",
    condition_prefectures: ev.condition_prefectures ?? [],
    condition_sport_ids: ev.condition_sport_ids ?? [],
    activity_type: ev.activity_type ?? null,
  };

  return (
    <EditEventForm
      event={event}
      premium={premium}
      sports={sports}
      hasApplicants={hasApplicants}
      deleteError={error === "has_applicants"}
    />
  );
}
