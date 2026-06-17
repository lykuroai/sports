"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// submitted_data のキーは facilities のカラム名に一致させる
// （管理者承認時にそのまま facilities へ反映されるため）。
const facilityFields = z.object({
  name: z.string().min(1, "施設名を入力してください").max(200),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  nearest_station: z.string().optional(),
  phone: z.string().optional(),
  website_url: z.string().url("公式サイトURLの形式が正しくありません").optional().or(z.literal("")),
  price_description: z.string().optional(),
  facility_type: z.string().optional(),
});

const newSchema = facilityFields.extend({
  evidence_url: z.string().url("根拠URLの形式が正しくありません").optional().or(z.literal("")),
  comment: z.string().max(2000).optional(),
});

export type SubmitState = { error: string | null; ok?: boolean };

function buildData(v: z.infer<typeof facilityFields>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string" && val.trim() !== "") out[k] = val.trim();
  }
  return out;
}

/** 新規施設の登録申請（仕様 §6.6） */
export async function submitNewFacility(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = newSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const { evidence_url, comment, ...fields } = parsed.data;

  const { error } = await supabase.from("facility_submissions").insert({
    submitted_by: user.id,
    submission_type: "new",
    submitted_data: buildData(fields),
    evidence_url: evidence_url || null,
    comment: comment || null,
    status: "pending",
  });
  if (error) return { error: error.message };

  return { error: null, ok: true };
}

/** 既存施設の修正申請（仕様 §6.6） */
export async function submitFacilityCorrection(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const facilityId = formData.get("facility_id") as string;
  if (!facilityId) return { error: "施設が指定されていません" };

  const parsed = newSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const { evidence_url, comment, ...fields } = parsed.data;

  const data = buildData(fields);
  if (Object.keys(data).length === 0) return { error: "修正内容を入力してください" };

  const { error } = await supabase.from("facility_submissions").insert({
    facility_id: facilityId,
    submitted_by: user.id,
    submission_type: "correction",
    submitted_data: data,
    evidence_url: evidence_url || null,
    comment: comment || null,
    status: "pending",
  });
  if (error) return { error: error.message };

  return { error: null, ok: true };
}
