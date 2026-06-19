"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";

// submitted_data のキーは facility.facilities のカラム名に一致させること。
// 管理者承認時に reviewFacilitySubmission がそのまま facilities へ insert/update する。
const schema = z.object({
  name: z.string().min(1, "施設名を入力してください").max(200),
  facility_type: z.string().max(60).optional(),
  prefecture: z.string().max(20).optional(),
  city: z.string().max(60).optional(),
  address: z.string().max(200).optional(),
  source_url: z.string().url("URL の形式が正しくありません").optional().or(z.literal("")),
});

export type SubmitState = { error: string | null; ok?: boolean };

export async function submitFacility(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/submit");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const v = parsed.data;

  const { error } = await supabase
    .schema(SCHEMA.facility)
    .from("facility_submissions")
    .insert({
      user_id: user.id,
      submission_type: "new",
      submitted_data: {
        name: v.name,
        facility_type: v.facility_type || null,
        prefecture: v.prefecture || null,
        city: v.city || null,
        address: v.address || null,
      },
      source_url: v.source_url || null,
    });

  if (error) return { error: error.message };
  return { error: null, ok: true };
}
