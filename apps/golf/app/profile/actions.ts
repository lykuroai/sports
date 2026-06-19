"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@spotomo/auth-client";

const schema = z.object({
  average_score: z.coerce.number().int().min(0).max(300).optional().or(z.literal(NaN)),
  handicap: z.coerce.number().min(-10).max(60).optional().or(z.literal(NaN)),
  preferred_area: z.string().optional(),
  club_owned: z.coerce.boolean().optional(),
  beginner_friendly: z.coerce.boolean().optional(),
});

export type GolfProfileState = { error: string | null; ok?: boolean };

export async function updateGolfProfile(
  _prev: GolfProfileState,
  formData: FormData,
): Promise<GolfProfileState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const v = parsed.data;

  const { error } = await supabase
    .schema("golf")
    .from("user_profiles")
    .upsert({
      user_id: user.id,
      average_score: Number.isNaN(v.average_score) ? null : v.average_score ?? null,
      handicap: Number.isNaN(v.handicap) ? null : v.handicap ?? null,
      preferred_area: v.preferred_area || null,
      club_owned: v.club_owned ?? false,
      beginner_friendly: v.beginner_friendly ?? true,
    });

  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { error: null, ok: true };
}
