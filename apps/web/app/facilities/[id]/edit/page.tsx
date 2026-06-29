import { redirect, notFound } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import type { Facility } from "@spotomo/shared-types";
import { updateFacility } from "./actions";
import { FacilityEditForm } from "./edit-form";

export const metadata = { title: "施設情報の編集" };

// 承認済み運営者による施設情報の直接編集（即時反映）。【方針: 一般ユーザ兼施設運営者】
// 編集可否は DB の RLS facility.is_owner（status='verified'）で担保。ここでは画面ガードも行う。
export default async function FacilityEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/facilities/${id}/edit`)}`);

  const { data: own } = await supabase
    .schema(SCHEMA.facility)
    .from("facility_owners")
    .select("status")
    .eq("facility_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if ((own as { status?: string } | null)?.status !== "verified") redirect(`/facilities/${id}`);

  const { data: facility } = await supabase
    .schema(SCHEMA.facility)
    .from("facilities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!facility) notFound();
  const f = facility as Facility;

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">施設情報の編集</h1>
      <p className="text-sm text-slate-600">承認済み運営者として施設情報を直接更新します（保存すると即時反映されます）。</p>
      <FacilityEditForm action={updateFacility} facility={f} />
    </div>
  );
}
