"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { USER_REVIEW_TAGS } from "@/lib/constants";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** 当該募集で評価権限があるか（主催者 or 承認/参加済み）かつ開催日時が過去 */
async function assertReviewable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  recruitmentId: string,
) {
  const { data: r } = await supabase
    .from("recruitments")
    .select("organizer_id, event_start_at, status")
    .eq("id", recruitmentId)
    .maybeSingle();
  if (!r) return { ok: false as const, organizerId: null };

  const isPast = new Date(r.event_start_at).getTime() < Date.now() || r.status === "finished";
  if (!isPast) return { ok: false as const, organizerId: r.organizer_id };

  if (r.organizer_id === userId) return { ok: true as const, organizerId: r.organizer_id };

  const { data: me } = await supabase
    .from("recruitment_participants")
    .select("status")
    .eq("recruitment_id", recruitmentId)
    .eq("user_id", userId)
    .maybeSingle();
  const ok = !!me && ["approved", "attended"].includes(me.status);
  return { ok, organizerId: r.organizer_id };
}

const reviewSchema = z.object({
  recruitment_id: z.string().uuid(),
  target_user_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1, "評価を選択してください").max(5),
  comment: z.string().max(1000).optional(),
});

export type ReviewState = { error: string | null; ok?: boolean };

export async function submitUserReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const { supabase, user } = await requireUser();

  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const v = parsed.data;

  if (v.target_user_id === user.id) {
    return { error: "自分自身は評価できません" };
  }

  const { ok } = await assertReviewable(supabase, user.id, v.recruitment_id);
  if (!ok) return { error: "この募集を評価する権限がありません（開催前、または参加していません）" };

  // タグはチェックボックス群から収集し、許可リストで検証
  const tags = formData
    .getAll("review_tags")
    .map(String)
    .filter((t) => (USER_REVIEW_TAGS as readonly string[]).includes(t));

  const visibility = (formData.get("visibility") as string) === "public" ? "public" : "restricted";

  const { error } = await supabase.from("user_reviews").upsert(
    {
      reviewer_id: user.id,
      target_user_id: v.target_user_id,
      recruitment_id: v.recruitment_id,
      rating: v.rating,
      review_tags: tags,
      comment: v.comment || null,
      visibility,
    },
    { onConflict: "reviewer_id,target_user_id,recruitment_id" },
  );
  if (error) return { error: error.message };

  revalidatePath(`/recruitments/${v.recruitment_id}/review`);
  return { error: null, ok: true };
}

/** 主催者が募集を「開催済み」にする（参加/主催回数の集計トリガーが発火） */
export async function finishRecruitment(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const recruitmentId = formData.get("recruitment_id") as string;

  const { data: r } = await supabase
    .from("recruitments")
    .select("organizer_id")
    .eq("id", recruitmentId)
    .maybeSingle();
  if (!r || r.organizer_id !== user.id) return;

  await supabase
    .from("recruitments")
    .update({ status: "finished" })
    .eq("id", recruitmentId);

  revalidatePath(`/recruitments/${recruitmentId}`);
  redirect(`/recruitments/${recruitmentId}/review`);
}
