"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAdminClient,
  getAdminUser,
  writeAuditLog,
  SCHEMA,
} from "@spotomo/auth-client";
import { notifyUser } from "@spotomo/domain-common";

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

export async function reviewFacilityOwner(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const facilityId = String(formData.get("facility_id"));
  const userId = String(formData.get("user_id"));
  const decision = String(formData.get("decision")); // 'verified' | 'rejected'
  const now = new Date().toISOString();

  const db = createAdminClient();

  // 承認・却下を facility_owners に記録（複合主キー facility_id+user_id で特定）。
  await db
    .schema(SCHEMA.facility)
    .from("facility_owners")
    .update({
      status: decision,
      verified_at: decision === "verified" ? now : null,
      reviewed_by: admin.id,
      reviewed_at: now,
    })
    .eq("facility_id", facilityId)
    .eq("user_id", userId);

  // 承認時は大区分ロール facility_owner を付与（既にあれば無視）。
  if (decision === "verified") {
    await db
      .schema(SCHEMA.account)
      .from("user_roles")
      .upsert({ user_id: userId, role: "facility_owner" }, { onConflict: "user_id,role" });
  }

  const { data: fac } = await db
    .schema(SCHEMA.facility)
    .from("facilities")
    .select("name")
    .eq("id", facilityId)
    .maybeSingle();
  const facName = (fac as { name: string } | null)?.name ?? "施設";

  await notifyUser({
    userId,
    type: decision === "verified" ? "facility_owner_approved" : "facility_owner_rejected",
    title: decision === "verified" ? "施設運営者申請が承認されました" : "施設運営者申請の結果",
    body:
      decision === "verified"
        ? `「${facName}」の運営者として承認されました。施設情報を編集できます。`
        : `「${facName}」の運営者申請は今回は見送りとなりました。`,
    relatedType: "facility",
    relatedId: facilityId,
  });

  await writeAuditLog(admin.id, `facility_owner_${decision}`, "facility_owner", `${facilityId}:${userId}`, "facility");
  revalidatePath("/facility-owners");
}
