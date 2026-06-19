"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import { approveParticipant, rejectParticipant, cancelParticipation } from "@spotomo/domain-common";

const SCHEMA = "golf";
const SPORT_LABEL = "ゴルフ";

async function organizerOf(eventId: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: ev } = await supabase
    .schema(SCHEMA).from("events").select("organizer_id, title").eq("id", eventId).maybeSingle();
  return { supabase, user, ev };
}

export async function approveAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("event_id"));
  const applicantId = String(formData.get("applicant_id"));
  const { supabase, user, ev } = await organizerOf(eventId);
  if (!ev || ev.organizer_id !== user.id) return;
  await approveParticipant(supabase, SCHEMA, { eventId, applicantId, sportLabel: SPORT_LABEL, eventTitle: ev.title });
  revalidatePath(`/events/${eventId}/participants`);
}

export async function rejectAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("event_id"));
  const applicantId = String(formData.get("applicant_id"));
  const { supabase, user, ev } = await organizerOf(eventId);
  if (!ev || ev.organizer_id !== user.id) return;
  await rejectParticipant(supabase, SCHEMA, { eventId, applicantId, sportLabel: SPORT_LABEL, eventTitle: ev.title });
  revalidatePath(`/events/${eventId}/participants`);
}

export async function cancelAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("event_id"));
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await cancelParticipation(supabase, SCHEMA, { eventId, userId: user.id });
  revalidatePath(`/events/${eventId}`);
}
