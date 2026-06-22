"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient, loginUrlFor } from "@spotomo/auth-client";
import { applyToSportEvent, createSportEvent } from "@spotomo/domain-common";
import type { SupabaseClient } from "@supabase/supabase-js";

const SCHEMA = "golf";
const SPORT_LABEL = "ゴルフ";

const GOLF_RESERVATION_STATUSES = [
  "not_reserved",
  "planning",
  "reserved_external",
  "changed_external",
  "cancelled_external",
  "unknown",
] as const;

/**
 * 楽天GORA から引き継いだゴルフ場・プランを募集（event）に保存する。
 *   golf_courses（upsert）→ golf_plans（event 紐づけ）→ event_golf_details（関連＋予約状態）。
 * GORA 情報が無い募集では何もしない。
 */
async function saveGoraDetails(
  supabase: SupabaseClient,
  eventId: string,
  formData: FormData,
): Promise<void> {
  const f = (k: string): string | null => {
    const v = formData.get(k);
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? null : s;
  };
  const courseId = f("gora_course_id");
  const planId = f("gora_plan_id");
  if (!courseId || !planId) return;

  const intOrNull = (k: string): number | null => {
    const s = f(k);
    return s != null && !Number.isNaN(Number(s)) ? Number(s) : null;
  };
  const boolOrNull = (k: string): boolean | null => {
    const s = f(k);
    return s === "1" ? true : s === "0" ? false : null;
  };

  // 1. ゴルフ場（upsert by 楽天GORAゴルフ場ID）。
  const { data: course } = await supabase
    .schema(SCHEMA)
    .from("golf_courses")
    .upsert(
      {
        rakuten_gora_course_id: courseId,
        golf_course_name: f("gora_course_name") ?? courseId,
        prefecture: f("gora_prefecture"),
        address: f("gora_address"),
        golf_course_url: f("gora_course_url"),
        source_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "rakuten_gora_course_id" },
    )
    .select("id")
    .single();

  // 2. プラン・スナップショット（募集に紐づけ）。
  const { data: plan } = await supabase
    .schema(SCHEMA)
    .from("golf_plans")
    .insert({
      event_id: eventId,
      rakuten_gora_course_id: courseId,
      rakuten_gora_plan_id: planId,
      play_date: f("gora_play_date"),
      start_time_zone: f("gora_start_time"),
      plan_name: f("gora_plan_name"),
      price: intOrNull("gora_price"),
      lunch_included: boolOrNull("gora_lunch"),
      caddie_included: boolOrNull("gora_caddie"),
      cart_type: f("gora_cart"),
      two_sum_guaranteed: boolOrNull("gora_two_sum"),
      reserve_url: f("gora_reserve_url"),
      fetched_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  // 3. 募集とゴルフ予約情報の関連（予約前なので planning）。
  await supabase
    .schema(SCHEMA)
    .from("event_golf_details")
    .upsert({
      event_id: eventId,
      golf_course_id: (course as { id: string } | null)?.id ?? null,
      golf_plan_id: (plan as { id: string } | null)?.id ?? null,
      reservation_status: "planning",
      updated_at: new Date().toISOString(),
    });
}

const createSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください").max(120),
  description: z.string().max(4000).optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  event_start_at: z.string().min(1, "開催日時を入力してください"),
  capacity: z.coerce.number().int().min(1).max(200),
  participation_fee: z.coerce.number().int().min(0),
  approval_type: z.enum(["approval", "first_come"]),
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

  // 複数選択（チェックボックス）は getAll で取得。
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
    // チェックボックスは未チェック時に送信されない。値の有無で true/false を判定する
    // （z.coerce.boolean() は "false" 等も true になり、未送信は常に true に倒れてしまうため）。
    beginner_allowed: formData.get("beginner_allowed") === "true",
    approval_type: v.approval_type,
    gender_condition: v.gender_condition,
    skill_level: v.skill_level,
    condition_prefectures: conditionPrefectures,
    condition_sport_ids: conditionSportIds,
  });
  if ("error" in result) return { error: result.error };

  // 楽天GORA から引き継いだゴルフ場・プランがあれば保存。
  await saveGoraDetails(supabase, result.id, formData);

  revalidatePath("/");
  redirect(`/events/${result.id}`);
}

const updateSchema = createSchema.extend({ event_id: z.string().uuid() });

/** 募集の修正（主催者のみ。RLS golf_events_update が organizer_id=auth.uid() を保証）。 */
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

/** 募集の削除（主催者のみ・ソフトデリート）。deleted_at を立て status を cancelled にする。 */
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

  // DELETE 用 RLS が無いため、UPDATE（golf_events_update）でソフトデリートする。
  await supabase
    .schema(SCHEMA)
    .from("events")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.event_id)
    .eq("organizer_id", user.id);

  revalidatePath("/");
  redirect("/");
}

const reservationStatusSchema = z.object({
  event_id: z.string().uuid(),
  reservation_status: z.enum(GOLF_RESERVATION_STATUSES),
  external_reservation_note: z.string().max(2000).optional(),
});

/** 主催者が楽天GORA側の予約状態を手動で更新する（仕様 §8 / §17）。 */
export async function updateReservationStatus(formData: FormData): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = reservationStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const v = parsed.data;

  const confirmed = v.reservation_status === "reserved_external";
  // RLS（golf_details_owner_write）が主催者のみ書き込み可を保証する。
  await supabase
    .schema(SCHEMA)
    .from("event_golf_details")
    .upsert({
      event_id: v.event_id,
      reservation_status: v.reservation_status,
      external_reservation_note: v.external_reservation_note || null,
      confirmed_by: confirmed ? user.id : null,
      confirmed_at: confirmed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });

  revalidatePath(`/events/${v.event_id}`);
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
  // 種目アプリには /login が無いため、account 共通ログインへ誘導し認証後この募集詳細へ戻す。
  if (!user) redirect(await loginUrlFor(`/events/${String(formData.get("event_id") ?? "")}`));

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
