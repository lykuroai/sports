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

export async function reviewVerification(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const verificationId = String(formData.get("verification_id"));
  const userId = String(formData.get("user_id"));
  const decision = String(formData.get("decision")) === "approved" ? "verified" : "rejected";

  const db = createAdminClient();
  await db
    .schema(SCHEMA.account)
    .from("verifications")
    .update({ status: decision, reviewed_at: new Date().toISOString() })
    .eq("id", verificationId);

  // 承認時は本人確認済みフラグ（identity_verified_at）を記録する。
  if (decision === "verified") {
    await db
      .schema(SCHEMA.account)
      .from("users")
      .update({ identity_verified_at: new Date().toISOString() })
      .eq("id", userId);
  }

  await notifyUser({
    userId,
    type: decision === "verified" ? "identity_verified" : "identity_rejected",
    title: decision === "verified" ? "本人確認が承認されました" : "本人確認の結果",
    body:
      decision === "verified"
        ? "本人確認が承認されました。"
        : "本人確認は承認されませんでした。書類を確認のうえ再申請してください。",
    relatedType: "account_verification",
    relatedId: verificationId,
  });

  await writeAuditLog(admin.id, `verification_${decision}`, "verification", verificationId, "account");
  revalidatePath("/verifications");
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

// 募集（running.events）の違反削除。規約違反の募集をソフト削除（deleted_at）し status を
// 中止にすることで、公開一覧・詳細から除外する。主催者へ通知し、理由付きで監査ログに記録する。
// 復旧が必要な場合に備え物理削除はしない（仕様 §11.1・§15.9）。
export async function deleteRecruitment(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const eventId = String(formData.get("event_id"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!eventId) return;

  const db = createAdminClient();
  const { data: ev } = await db
    .schema(SCHEMA.running)
    .from("events")
    .select("organizer_id, title")
    .eq("id", eventId)
    .maybeSingle();

  await db
    .schema(SCHEMA.running)
    .from("events")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
    .eq("id", eventId);

  const organizerId = (ev as { organizer_id?: string } | null)?.organizer_id;
  const title = (ev as { title?: string } | null)?.title ?? "募集";
  if (organizerId) {
    await notifyUser({
      userId: organizerId,
      type: "recruitment_removed",
      title: "募集が削除されました",
      body: `あなたの募集「${title}」は規約違反のため運営により削除されました。${reason ? ` 理由: ${reason}` : ""}`,
      relatedType: "event",
      relatedId: eventId,
    });
  }

  await writeAuditLog(admin.id, "recruitment_delete", "event", eventId, "running", reason ? { reason } : undefined);
  revalidatePath("/recruitments");
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
    // submitted_data のキーは facilities のカラム名に一致している前提。
    // sport_ids だけは facilities のカラムではなく、承認時に facility_sports へ展開する
    // （一般登録 /facilities/register が付与。種目検索 facility_sports!inner で見つかるようにする）。
    const { sport_ids, ...facilityData } = (sub.submitted_data ?? {}) as Record<string, unknown> & {
      sport_ids?: unknown;
    };
    const sportIds = Array.isArray(sport_ids) ? sport_ids.filter((s): s is string => typeof s === "string") : [];

    if (sub.submission_type === "new") {
      const { data: inserted } = await db
        .schema(SCHEMA.facility)
        .from("facilities")
        .insert({ ...facilityData, source: "user_submission" })
        .select("id")
        .maybeSingle();
      const facilityId = (inserted as { id?: string } | null)?.id;
      if (facilityId && sportIds.length > 0) {
        await db
          .schema(SCHEMA.facility)
          .from("facility_sports")
          .insert(sportIds.map((sportId) => ({ facility_id: facilityId, sport_id: sportId })));
      }
    } else if (sub.facility_id) {
      await db.schema(SCHEMA.facility).from("facilities").update(facilityData).eq("id", sub.facility_id);
      if (sportIds.length > 0) {
        // 修正申請で種目が付く場合は upsert（既存 PK は重複無視）。
        await db
          .schema(SCHEMA.facility)
          .from("facility_sports")
          .upsert(
            sportIds.map((sportId) => ({ facility_id: sub.facility_id, sport_id: sportId })),
            { onConflict: "facility_id,sport_id", ignoreDuplicates: true },
          );
      }
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

// 自動取り込み（OSM等）の未承認施設を承認/却下する。承認→status='verified' で
// 公開、却下→status='rejected'（重複や品質不良）。出所(facility_sources)は保持する。
export async function reviewImportedFacility(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const facilityId = String(formData.get("facility_id"));
  const decision = String(formData.get("decision")) === "approved" ? "verified" : "rejected";

  const db = createAdminClient();
  await db
    .schema(SCHEMA.facility)
    .from("facilities")
    .update({ status: decision, last_checked_at: new Date().toISOString() })
    .eq("id", facilityId);
  await writeAuditLog(admin.id, `facility_import_${decision}`, "facility", facilityId, "facility");
  revalidatePath("/facilities");
}

// 取り込み施設をまとめて承認/却下する（承認運用の効率化）。チェックした施設、または
// 「このページをすべて」のための hidden 群を facility_ids として受け取る。
export async function bulkReviewImportedFacilities(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const decision = String(formData.get("decision")) === "approved" ? "verified" : "rejected";
  const ids = formData.getAll("facility_ids").map(String).filter(Boolean);
  if (ids.length === 0) return;

  const db = createAdminClient();
  await db
    .schema(SCHEMA.facility)
    .from("facilities")
    .update({ status: decision, last_checked_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "unverified"); // 取り込み未承認のみを対象に限定（誤操作防止）
  await writeAuditLog(admin.id, `facility_import_bulk_${decision}`, "facility", `count:${ids.length}`, "facility", { count: ids.length });
  revalidatePath("/facilities");
}

// 取り込み施設（source）を既存施設（target）へ統合する。出所・種目を target へ移し、
// source を削除する。重複の自動統合はせず、管理者が候補を確認して実行する（仕様 §6.6）。
export async function mergeImportedFacility(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const sourceId = String(formData.get("source_facility_id"));
  const targetId = String(formData.get("target_facility_id"));
  if (!sourceId || !targetId || sourceId === targetId) return;

  const db = createAdminClient();
  const fac = db.schema(SCHEMA.facility);

  // 1) 出所(facility_sources)を target へ付け替え（OSM の source_id は一意なので衝突しない）。
  await fac.from("facility_sources").update({ facility_id: targetId }).eq("facility_id", sourceId);

  // 2) 種目(facility_sports)のうち target に無いものを移す。
  const [{ data: srcSports }, { data: tgtSports }] = await Promise.all([
    fac.from("facility_sports").select("sport_id").eq("facility_id", sourceId),
    fac.from("facility_sports").select("sport_id").eq("facility_id", targetId),
  ]);
  const have = new Set((tgtSports ?? []).map((s: { sport_id: string }) => s.sport_id));
  const toAdd = ((srcSports ?? []) as { sport_id: string }[])
    .filter((s) => !have.has(s.sport_id))
    .map((s) => ({ facility_id: targetId, sport_id: s.sport_id }));
  if (toAdd.length) await fac.from("facility_sports").insert(toAdd);

  // 3) source を削除（残る子テーブルは ON DELETE CASCADE。出所は移済みで消えない）。
  await fac.from("facilities").delete().eq("id", sourceId);

  await writeAuditLog(admin.id, "facility_merge", "facility", `${sourceId}->${targetId}`, "facility");
  revalidatePath("/facilities");
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
