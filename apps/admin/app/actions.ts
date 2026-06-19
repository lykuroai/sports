"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAdminClient,
  getAdminUser,
  writeAuditLog,
  SCHEMA,
} from "@spotomo/auth-client";

// 管理操作は必ず getAdminUser() で検証し、サービスロールで RLS をバイパスして実行、
// core.audit_logs に記録する（CLAUDE.md / 仕様 §11.1）。

export async function suspendUser(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const userId = String(formData.get("user_id"));
  const next = String(formData.get("status") ?? "suspended");

  const db = createAdminClient();
  await db.schema(SCHEMA.account).from("users").update({ status: next }).eq("id", userId);
  await writeAuditLog(admin.id, `user_${next}`, "user", userId, "account");
  revalidatePath("/users");
}

export async function resolveReport(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const reportId = String(formData.get("report_id"));
  const action = String(formData.get("action") ?? "none");

  const db = createAdminClient();
  await db
    .schema(SCHEMA.core)
    .from("reports")
    .update({ status: "actioned", action })
    .eq("id", reportId);
  await writeAuditLog(admin.id, "report_resolve", "report", reportId, "core", { action });
  revalidatePath("/reports");
}

export async function reviewFacilitySubmission(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const submissionId = String(formData.get("submission_id"));
  const decision = String(formData.get("decision")); // 'approved' | 'rejected'

  const db = createAdminClient();
  const { data: sub } = await db
    .schema(SCHEMA.facility)
    .from("facility_submissions")
    .select("id, submission_type, submitted_data, facility_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return;

  if (decision === "approved") {
    // submitted_data のキーは facilities のカラム名に一致している前提
    if (sub.submission_type === "new") {
      await db.schema(SCHEMA.facility).from("facilities").insert({ ...sub.submitted_data, source: "user_submission" });
    } else if (sub.facility_id) {
      await db.schema(SCHEMA.facility).from("facilities").update(sub.submitted_data).eq("id", sub.facility_id);
    }
  }

  await db
    .schema(SCHEMA.facility)
    .from("facility_submissions")
    .update({ status: decision, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);
  await writeAuditLog(admin.id, `facility_submission_${decision}`, "facility_submission", submissionId, "facility");
  revalidatePath("/facility-submissions");
}
