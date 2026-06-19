"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@spotomo/auth-client";

const schema = z.object({
  activity_type: z.string().max(120).optional(),
  experience_level: z.string().max(60).optional(),
  gear_owned: z.string().max(500).optional(), // カンマ区切り → text[]
  transportation: z.string().max(60).optional(),
  solo_participation_ok: z.coerce.boolean().optional(),
});

export type OutdoorProfileState = { error: string | null; ok?: boolean };

export async function updateOutdoorProfile(
  _prev: OutdoorProfileState,
  formData: FormData,
): Promise<OutdoorProfileState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const v = parsed.data;

  const gear = (v.gear_owned ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { error } = await supabase
    .schema("outdoor")
    .from("user_profiles")
    .upsert({
      user_id: user.id,
      activity_type: v.activity_type || null,
      experience_level: v.experience_level || null,
      gear_owned: gear.length ? gear : null,
      transportation: v.transportation || null,
      solo_participation_ok: v.solo_participation_ok ?? true,
    });

  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { error: null, ok: true };
}
