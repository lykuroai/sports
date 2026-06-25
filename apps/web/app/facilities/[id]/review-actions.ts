"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";

const schema = z.object({
  facility_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// 施設レビュー投稿（1施設1ユーザー1件・再投稿で上書き）。RLS は user_id=auth.uid() で
// 本人のみ書込可のため、ログインセッションのクライアントでそのまま insert/upsert できる。
export async function submitFacilityReview(formData: FormData): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await supabase
    .schema(SCHEMA.facility)
    .from("facility_reviews")
    .upsert(
      {
        facility_id: parsed.data.facility_id,
        user_id: user.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      },
      { onConflict: "facility_id,user_id" },
    );

  revalidatePath(`/facilities/${parsed.data.facility_id}`);
}
