"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const aspect = z.coerce.number().int().min(1).max(5).optional().or(z.literal(NaN));

const schema = z.object({
  facility_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1, "総合評価を選択してください").max(5),
  equipment_rating: aspect,
  cleanliness_rating: aspect,
  access_rating: aspect,
  price_rating: aspect,
  comment: z.string().max(1000).optional(),
});

export type FacilityReviewState = { error: string | null; ok?: boolean };

const num = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? null : v);

export async function submitFacilityReview(
  _prev: FacilityReviewState,
  formData: FormData,
): Promise<FacilityReviewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const v = parsed.data;

  const { error } = await supabase.from("facility_reviews").insert({
    facility_id: v.facility_id,
    user_id: user.id,
    rating: v.rating,
    equipment_rating: num(v.equipment_rating),
    cleanliness_rating: num(v.cleanliness_rating),
    access_rating: num(v.access_rating),
    price_rating: num(v.price_rating),
    comment: v.comment || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/facilities/${v.facility_id}`);
  return { error: null, ok: true };
}
