"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@spotomo/auth-client";
import { applyToSportEvent, createSportEvent } from "@spotomo/domain-common";

const SCHEMA = "outdoor";
const SPORT_LABEL = "アウトドア";

const createSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください").max(120),
  description: z.string().max(4000).optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  event_start_at: z.string().min(1, "開催日時を入力してください"),
  capacity: z.coerce.number().int().min(1).max(200),
  participation_fee: z.coerce.number().int().min(0),
  beginner_allowed: z.coerce.boolean().optional(),
  approval_type: z.enum(["approval", "first_come"]),
  activity_type: z.string().max(120).optional(),
});

export type CreateState = { error: string | null };

export async function createEvent(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/events/new");

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const v = parsed.data;

  const result = await createSportEvent(supabase, SCHEMA, {
    organizer_id: user.id,
    title: v.title,
    description: v.description || null,
    prefecture: v.prefecture || null,
    city: v.city || null,
    event_start_at: new Date(v.event_start_at).toISOString(),
    capacity: v.capacity,
    participation_fee: v.participation_fee,
    beginner_allowed: v.beginner_allowed ?? true,
    approval_type: v.approval_type,
    extra: v.activity_type ? { activity_type: v.activity_type } : undefined,
  });
  if ("error" in result) return { error: result.error };

  revalidatePath("/");
  redirect(`/events/${result.id}`);
}

const applySchema = z.object({
  event_id: z.string().uuid(),
  application_message: z.string().max(1000).optional(),
});

export async function applyToEvent(formData: FormData): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = applySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await applyToSportEvent(supabase, SCHEMA, {
    eventId: parsed.data.event_id,
    userId: user.id,
    message: parsed.data.application_message,
    sportLabel: SPORT_LABEL,
  });

  revalidatePath(`/events/${parsed.data.event_id}`);
}
