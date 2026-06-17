"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { REPORT_REASONS } from "@/lib/constants";

const schema = z.object({
  target_type: z.enum(["recruitment", "user", "message", "facility", "review"]),
  target_id: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  description: z.string().max(2000).optional(),
  evidence_url: z.string().url("URLの形式が正しくありません").optional().or(z.literal("")),
});

export type ReportState = { error: string | null; ok?: boolean };

export async function submitReport(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const v = parsed.data;

  // RLS: reports_insert（reporter_id = auth.uid()）
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: v.target_type,
    target_id: v.target_id,
    reason: v.reason,
    description: v.description || null,
    evidence_url: v.evidence_url || null,
    status: "open",
  });
  if (error) return { error: error.message };

  return { error: null, ok: true };
}
