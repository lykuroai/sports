"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";

const schema = z.object({
  nickname: z.string().min(1, "ニックネームを入力してください").max(50),
  introduction: z.string().max(2000).optional(),
  gender: z.enum(["male", "female", "other", "unspecified"]),
  age_range: z.string().optional(),
  area: z.string().optional(),
});

export type ProfileState = { error: string | null; ok?: boolean };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const v = parsed.data;
  // account.profiles を upsert（初回ログイン後に行が無い場合に備える）
  const { error } = await supabase
    .schema(SCHEMA.account)
    .from("profiles")
    .upsert({
      user_id: user.id,
      nickname: v.nickname,
      introduction: v.introduction || null,
      gender: v.gender,
      age_range: v.age_range || null,
      area: v.area || null,
    });

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { error: null, ok: true };
}
