"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  display_name: z.string().min(1, "表示名を入力してください").max(50),
  introduction: z.string().max(2000).optional(),
  gender: z.enum(["male", "female", "other", "unspecified"]),
  birth_year: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional().or(z.literal(NaN)),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  activity_area: z.string().optional(),
});

export type ProfileState = { error: string | null; ok?: boolean };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const v = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: v.display_name,
      introduction: v.introduction || null,
      gender: v.gender,
      birth_year: Number.isNaN(v.birth_year) ? null : v.birth_year ?? null,
      prefecture: v.prefecture || null,
      city: v.city || null,
      activity_area: v.activity_area || null,
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mypage");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}
