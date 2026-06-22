"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@spotomo/auth-client";
import { applyToSportEvent, createSportEvent } from "@spotomo/domain-common";

const SCHEMA = "running";
const SPORT_LABEL = "ランニング";

const createSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください").max(120),
  description: z.string().max(4000).optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  event_start_at: z.string().min(1, "開催日時を入力してください"),
  capacity: z.coerce.number().int().min(1).max(200),
  participation_fee: z.coerce.number().int().min(0),
  approval_type: z.enum(["approval", "first_come"]),
  target_pace: z.string().max(120).optional(),
  // 参加者条件（プレミアム会員のみ。非会員は DB トリガーで無効化される）。
  gender_condition: z.enum(["male", "female", "other", "unspecified"]).optional(),
  skill_level: z.enum(["beginner", "intermediate", "advanced", "any"]).optional(),
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

  const conditionPrefectures = formData.getAll("condition_prefectures").map(String).filter(Boolean);
  const conditionSportIds = formData.getAll("condition_sport_ids").map(String).filter(Boolean);

  const result = await createSportEvent(supabase, SCHEMA, {
    organizer_id: user.id,
    title: v.title,
    description: v.description || null,
    prefecture: v.prefecture || null,
    city: v.city || null,
    event_start_at: new Date(v.event_start_at).toISOString(),
    capacity: v.capacity,
    participation_fee: v.participation_fee,
    // チェックボックスは未チェック時に送信されないため、値の有無で判定する。
    beginner_allowed: formData.get("beginner_allowed") === "true",
    approval_type: v.approval_type,
    gender_condition: v.gender_condition,
    skill_level: v.skill_level,
    condition_prefectures: conditionPrefectures,
    condition_sport_ids: conditionSportIds,
    extra: v.target_pace ? { target_pace: v.target_pace } : undefined,
  });
  if ("error" in result) return { error: result.error };

  revalidatePath("/");
  redirect(`/events/${result.id}`);
}

const updateSchema = createSchema.extend({ event_id: z.string().uuid() });

/** 募集の修正（主催者のみ。RLS が organizer_id=auth.uid() を保証）。 */
export async function updateEvent(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/events/new");

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const v = parsed.data;

  const conditionPrefectures = formData.getAll("condition_prefectures").map(String).filter(Boolean);
  const conditionSportIds = formData.getAll("condition_sport_ids").map(String).filter(Boolean);

  // 参加者条件はプレミアム会員のみ。非会員の値は DB トリガー enforce_event_premium が無効化する。
  const { error } = await supabase
    .schema(SCHEMA)
    .from("events")
    .update({
      title: v.title,
      description: v.description || null,
      prefecture: v.prefecture || null,
      city: v.city || null,
      event_start_at: new Date(v.event_start_at).toISOString(),
      capacity: v.capacity,
      participation_fee: v.participation_fee,
      beginner_allowed: formData.get("beginner_allowed") === "true",
      approval_type: v.approval_type,
      gender_condition: v.gender_condition ?? "unspecified",
      skill_level: v.skill_level ?? "any",
      condition_prefectures: conditionPrefectures,
      condition_sport_ids: conditionSportIds,
      target_pace: v.target_pace || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", v.event_id)
    .eq("organizer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath(`/events/${v.event_id}`);
  redirect(`/events/${v.event_id}`);
}

const deleteSchema = z.object({ event_id: z.string().uuid() });

/** 募集の削除（主催者のみ・ソフトデリート）。 */
export async function deleteEvent(formData: FormData): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = deleteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  // 応募者（申請中・承認済み・キャンセル待ち）がいる募集は削除させない。
  const { count } = await supabase
    .schema(SCHEMA)
    .from("event_participants")
    .select("user_id", { count: "exact", head: true })
    .eq("event_id", parsed.data.event_id)
    .in("status", ["applied", "approved", "waitlist"]);
  if ((count ?? 0) > 0) redirect(`/events/${parsed.data.event_id}/edit?error=has_applicants`);

  await supabase
    .schema(SCHEMA)
    .from("events")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.event_id)
    .eq("organizer_id", user.id);

  revalidatePath("/");
  redirect("/");
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
