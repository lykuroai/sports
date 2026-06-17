"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MVP_APPROVAL_TYPES } from "@/lib/constants";
import { notifyUser } from "@/lib/notify";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const recruitmentSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください").max(120),
  sport_id: z.string().uuid("種目を選択してください"),
  description: z.string().max(4000).optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  facility_id: z.string().uuid().optional().or(z.literal("")),
  location_description: z.string().optional(),
  meeting_place: z.string().optional(),
  event_start_at: z.string().min(1, "開催日時を入力してください"),
  event_end_at: z.string().optional(),
  application_deadline: z.string().optional(),
  capacity: z.coerce.number().int().min(1, "定員は1以上で入力してください").max(1000),
  participation_fee: z.coerce.number().int().min(0).max(1_000_000),
  skill_level: z.enum(["beginner", "intermediate", "advanced", "any"]),
  beginner_allowed: z.coerce.boolean(),
  gender_condition: z.enum(["male", "female", "other", "unspecified"]),
  approval_type: z.enum(["approval", "first_come"]),
  rain_policy: z.string().optional(),
  cancellation_policy: z.string().optional(),
});

export type FormState = { error: string | null };

function toTimestamp(v?: string): string | null {
  return v && v.length > 0 ? new Date(v).toISOString() : null;
}

export async function createRecruitment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();

  const parsed = recruitmentSchema.safeParse({
    ...Object.fromEntries(formData),
    beginner_allowed: formData.get("beginner_allowed") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }
  const v = parsed.data;
  if (!MVP_APPROVAL_TYPES.includes(v.approval_type)) {
    return { error: "現在は承認制・先着順のみ利用できます" };
  }

  const isPublish = formData.get("action") === "publish";

  const { data, error } = await supabase
    .from("recruitments")
    .insert({
      organizer_id: user.id,
      sport_id: v.sport_id,
      facility_id: v.facility_id || null,
      title: v.title,
      description: v.description || null,
      prefecture: v.prefecture || null,
      city: v.city || null,
      location_description: v.location_description || null,
      meeting_place: v.meeting_place || null,
      event_start_at: new Date(v.event_start_at).toISOString(),
      event_end_at: toTimestamp(v.event_end_at),
      application_deadline: toTimestamp(v.application_deadline),
      capacity: v.capacity,
      participation_fee: v.participation_fee,
      skill_level: v.skill_level,
      beginner_allowed: v.beginner_allowed,
      gender_condition: v.gender_condition,
      approval_type: v.approval_type,
      rain_policy: v.rain_policy || null,
      cancellation_policy: v.cancellation_policy || null,
      status: isPublish ? "open" : "draft",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // チャットルームを同時作成し、主催者を登録（仕様 §6.7）
  const { data: room } = await supabase
    .from("chat_rooms")
    .insert({ recruitment_id: data.id })
    .select("id")
    .single();
  if (room) {
    await supabase
      .from("chat_room_members")
      .insert({ chat_room_id: room.id, user_id: user.id, role: "organizer" });
  }

  revalidatePath("/recruitments");
  redirect(`/recruitments/${data.id}`);
}

/** 参加申請（承認制=applied / 先着順=空きがあれば approved） */
export async function applyToRecruitment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const recruitmentId = formData.get("recruitment_id") as string;
  const message = (formData.get("application_message") as string) || null;

  const { data: r } = await supabase
    .from("recruitments")
    .select("id, organizer_id, capacity, approval_type, status")
    .eq("id", recruitmentId)
    .maybeSingle();
  if (!r) return { error: "募集が見つかりません" };
  if (r.organizer_id === user.id) return { error: "自分の募集には参加申請できません" };
  if (!["open", "few_left"].includes(r.status)) {
    return { error: "現在この募集は参加申請を受け付けていません" };
  }

  // ブロック関係があれば参加申請を拒否（仕様 §6.11）
  const { data: blocked } = await supabase.rpc("is_blocked_between", {
    a: user.id,
    b: r.organizer_id,
  });
  if (blocked) return { error: "この募集には参加申請できません" };

  // 先着順は即承認。ただし定員超過時はキャンセル待ち。
  let status: "applied" | "approved" | "waitlist" = "applied";
  if (r.approval_type === "first_come") {
    const { count } = await supabase
      .from("recruitment_participants")
      .select("*", { count: "exact", head: true })
      .eq("recruitment_id", recruitmentId)
      .eq("status", "approved");
    status = (count ?? 0) < r.capacity ? "approved" : "waitlist";
  }

  const { error } = await supabase.from("recruitment_participants").upsert(
    {
      recruitment_id: recruitmentId,
      user_id: user.id,
      status,
      application_message: message,
      applied_at: new Date().toISOString(),
      approved_at: status === "approved" ? new Date().toISOString() : null,
    },
    { onConflict: "recruitment_id,user_id" },
  );
  if (error) return { error: error.message };

  if (status === "approved") await joinChat(supabase, recruitmentId, user.id);
  await notify(supabase, r.organizer_id, "application_received", "参加申請が届きました", recruitmentId);

  revalidatePath(`/recruitments/${recruitmentId}`);
  return { error: null };
}

/** 主催者による承認/拒否 */
export async function decideApplication(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const recruitmentId = formData.get("recruitment_id") as string;
  const targetUserId = formData.get("user_id") as string;
  const decision = formData.get("decision") as "approve" | "reject";

  const { data: r } = await supabase
    .from("recruitments")
    .select("organizer_id")
    .eq("id", recruitmentId)
    .maybeSingle();
  if (!r || r.organizer_id !== user.id) return; // RLS でも保護されるが二重チェック

  const newStatus = decision === "approve" ? "approved" : "rejected";
  await supabase
    .from("recruitment_participants")
    .update({
      status: newStatus,
      approved_at: decision === "approve" ? new Date().toISOString() : null,
    })
    .eq("recruitment_id", recruitmentId)
    .eq("user_id", targetUserId);

  if (decision === "approve") {
    await joinChat(supabase, recruitmentId, targetUserId);
    await notify(supabase, targetUserId, "application_approved", "参加申請が承認されました", recruitmentId);
  } else {
    await notify(supabase, targetUserId, "application_rejected", "参加申請が見送られました", recruitmentId);
  }

  revalidatePath(`/recruitments/${recruitmentId}`);
}

/** 参加者本人によるキャンセル */
export async function cancelParticipation(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const recruitmentId = formData.get("recruitment_id") as string;

  await supabase
    .from("recruitment_participants")
    .update({ status: "cancelled_self", cancelled_at: new Date().toISOString() })
    .eq("recruitment_id", recruitmentId)
    .eq("user_id", user.id);

  revalidatePath(`/recruitments/${recruitmentId}`);
}

// --- ヘルパー ---
type SupabaseAny = Awaited<ReturnType<typeof createClient>>;

async function joinChat(supabase: SupabaseAny, recruitmentId: string, userId: string) {
  const { data: room } = await supabase
    .from("chat_rooms")
    .select("id")
    .eq("recruitment_id", recruitmentId)
    .maybeSingle();
  if (room) {
    await supabase
      .from("chat_room_members")
      .upsert(
        { chat_room_id: room.id, user_id: userId, role: "participant" },
        { onConflict: "chat_room_id,user_id" },
      );
  }
}

async function notify(
  _supabase: SupabaseAny,
  userId: string,
  type: string,
  title: string,
  recruitmentId: string,
) {
  // 通知作成 + メール送信はサービスロール経由の共通ヘルパーで行う
  await notifyUser({ userId, type, title, relatedType: "recruitment", relatedId: recruitmentId });
}
