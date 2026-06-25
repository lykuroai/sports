"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@spotomo/auth-client";

const schema = z.object({
  pace: z.string().max(60).optional(),
  distance_preference: z.string().max(60).optional(),
  race_experience: z.string().max(200).optional(),
  preferred_time: z.string().max(60).optional(),
});

export type RunProfileState = { error: string | null; ok?: boolean };

export async function updateRunningProfile(
  _prev: RunProfileState,
  formData: FormData,
): Promise<RunProfileState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const v = parsed.data;

  const { error } = await supabase
    .schema("running")
    .from("user_profiles")
    .upsert({
      user_id: user.id,
      pace: v.pace || null,
      distance_preference: v.distance_preference || null,
      race_experience: v.race_experience || null,
      preferred_time: v.preferred_time || null,
    });

  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { error: null, ok: true };
}
