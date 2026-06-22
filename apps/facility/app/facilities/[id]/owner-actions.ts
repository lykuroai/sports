"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";

/**
 * 施設運営者への申請。pending 行を本人として作成する（RLS: user_id=auth.uid() かつ status='pending'）。
 * 承認は管理画面（reviewFacilityOwner）で行い、verified になると施設編集が可能になる。
 */
export async function applyForOwnership(formData: FormData): Promise<void> {
  const facilityId = String(formData.get("facility_id"));
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/facilities/${facilityId}`);

  // 既存行があれば二重申請なので何もしない（UI でも申請済みは申請フォームを出さない）。
  const { data: existing } = await supabase
    .schema(SCHEMA.facility)
    .from("facility_owners")
    .select("status")
    .eq("facility_id", facilityId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    revalidatePath(`/facilities/${facilityId}`);
    return;
  }

  await supabase
    .schema(SCHEMA.facility)
    .from("facility_owners")
    .insert({
      facility_id: facilityId,
      user_id: user.id,
      status: "pending",
      evidence_url: String(formData.get("evidence_url") ?? "") || null,
      note: String(formData.get("note") ?? "") || null,
    });

  revalidatePath(`/facilities/${facilityId}`);
}

/** 自分の pending 申請を取り下げる。 */
export async function withdrawOwnership(formData: FormData): Promise<void> {
  const facilityId = String(formData.get("facility_id"));
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .schema(SCHEMA.facility)
    .from("facility_owners")
    .delete()
    .eq("facility_id", facilityId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  revalidatePath(`/facilities/${facilityId}`);
}
