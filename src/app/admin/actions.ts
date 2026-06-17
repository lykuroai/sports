"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser, writeAuditLog } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notify";

async function ensureAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("管理者権限が必要です");
  return user;
}

// ---------- 利用者管理 ----------
export async function setUserStatus(formData: FormData): Promise<void> {
  const admin = await ensureAdmin();
  const userId = formData.get("user_id") as string;
  const status = formData.get("status") as string;
  if (!["active", "suspended", "banned"].includes(status)) return;

  const db = createAdminClient();
  await db.from("users").update({ status }).eq("id", userId);
  await writeAuditLog(admin.id, "user.set_status", "user", userId, { status });

  revalidatePath("/admin/users");
}

// ---------- 募集管理 ----------
export async function stopRecruitment(formData: FormData): Promise<void> {
  const admin = await ensureAdmin();
  const recruitmentId = formData.get("recruitment_id") as string;

  const db = createAdminClient();
  await db.from("recruitments").update({ status: "cancelled" }).eq("id", recruitmentId);
  await writeAuditLog(admin.id, "recruitment.stop", "recruitment", recruitmentId);

  revalidatePath("/admin/recruitments");
}

// ---------- 通報対応 ----------
export async function handleReport(formData: FormData): Promise<void> {
  const admin = await ensureAdmin();
  const reportId = formData.get("report_id") as string;
  const action = formData.get("action_type") as string;
  const allowed = ["none", "warned", "hidden", "recruitment_stopped", "chat_restricted", "suspended", "banned"];
  if (!allowed.includes(action)) return;

  const db = createAdminClient();
  const resolved = action === "none" ? "dismissed" : "actioned";
  await db
    .from("reports")
    .update({
      status: resolved,
      action_type: action,
      handled_by: admin.id,
      handled_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  await writeAuditLog(admin.id, "report.handle", "report", reportId, { action });

  revalidatePath("/admin/reports");
}

// ---------- 施設登録申請 ----------
export async function reviewFacilitySubmission(formData: FormData): Promise<void> {
  const admin = await ensureAdmin();
  const submissionId = formData.get("submission_id") as string;
  const decision = formData.get("decision") as "approve" | "reject";
  const rejectionReason = (formData.get("rejection_reason") as string) || null;

  const db = createAdminClient();
  const { data: sub } = await db
    .from("facility_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return;

  if (decision === "approve") {
    const payload = (sub.submitted_data ?? {}) as Record<string, unknown>;
    if (sub.submission_type === "correction" && sub.facility_id) {
      // 既存施設へ修正を反映
      await db.from("facilities").update({ ...payload, last_confirmed_at: new Date().toISOString() }).eq("id", sub.facility_id);
    } else {
      // 新規施設を作成（利用者申請のため verified=pending 相当）
      await db.from("facilities").insert({
        ...payload,
        source_type: "user_submission",
        verification_status: "verified",
        verified_at: new Date().toISOString(),
        last_confirmed_at: new Date().toISOString(),
      });
    }
  }

  await db
    .from("facility_submissions")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: decision === "reject" ? rejectionReason : null,
    })
    .eq("id", submissionId);

  // 申請者へ通知（仕様 §6.8）
  await notifyUser({
    userId: sub.submitted_by,
    type: decision === "approve" ? "facility_submission_approved" : "facility_submission_rejected",
    title: decision === "approve" ? "施設情報の申請が承認されました" : "施設情報の申請が見送られました",
    relatedType: "facility_submission",
    relatedId: submissionId,
  });

  await writeAuditLog(admin.id, `facility_submission.${decision}`, "facility_submission", submissionId);
  revalidatePath("/admin/facilities/submissions");
}

// ---------- カテゴリー管理 ----------
export async function toggleSportStatus(formData: FormData): Promise<void> {
  const adminUser = await ensureAdmin();
  const sportId = formData.get("sport_id") as string;
  const next = formData.get("status") as string;
  if (!["published", "unpublished"].includes(next)) return;

  const db = createAdminClient();
  await db.from("sports").update({ status: next }).eq("id", sportId);
  await writeAuditLog(adminUser.id, "sport.toggle_status", "sport", sportId, { status: next });

  revalidatePath("/admin/sports");
  revalidatePath("/recruitments");
}

export async function createSport(formData: FormData): Promise<void> {
  const adminUser = await ensureAdmin();
  const name = ((formData.get("name") as string) ?? "").trim();
  const slug = ((formData.get("slug") as string) ?? "").trim();
  const categoryType = formData.get("category_type") as string;
  if (!name || !slug || !["sports", "outdoor"].includes(categoryType)) return;

  const db = createAdminClient();
  const { error } = await db
    .from("sports")
    .insert({ name, slug, category_type: categoryType, display_order: 999, status: "published" });
  if (!error) {
    await writeAuditLog(adminUser.id, "sport.create", "sport", slug, { name, categoryType });
  }
  revalidatePath("/admin/sports");
}
