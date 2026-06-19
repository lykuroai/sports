"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@spotomo/auth-client";
import { notifyUser } from "@spotomo/domain-common";

const DOMAIN = "golf";

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

  const { data, error } = await supabase
    .schema(DOMAIN)
    .from("events")
    .insert({
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
      status: "open",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // イベント単位のグループチャットを作成し、主催者を参加させる
  const { data: room } = await supabase
    .schema(DOMAIN)
    .from("chat_rooms")
    .insert({ event_id: data.id })
    .select("id")
    .single();
  if (room) {
    await supabase
      .schema(DOMAIN)
      .from("chat_room_members")
      .insert({ chat_room_id: room.id, user_id: user.id, role: "organizer" });
  }

  revalidatePath("/");
  redirect(`/events/${data.id}`);
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
  const { event_id, application_message } = parsed.data;

  const { data: ev } = await supabase
    .schema(DOMAIN)
    .from("events")
    .select("organizer_id, approval_type, title")
    .eq("id", event_id)
    .maybeSingle();
  if (!ev) return;

  // 先着順なら即承認、それ以外は申請中
  const status = ev.approval_type === "first_come" ? "approved" : "applied";
  const { error } = await supabase
    .schema(DOMAIN)
    .from("event_participants")
    .upsert({
      event_id,
      user_id: user.id,
      status,
      application_message: application_message || null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    });
  if (error) return;

  // 主催者へ通知（共通の notifyUser 経由）
  await notifyUser({
    userId: ev.organizer_id,
    type: "event_apply",
    title: "新しい参加申請があります",
    body: `「${ev.title}」に参加申請がありました。`,
    relatedType: "golf_event",
    relatedId: event_id,
  });

  revalidatePath(`/events/${event_id}`);
}
