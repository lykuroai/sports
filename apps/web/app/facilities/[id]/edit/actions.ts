"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import type { SubmitState } from "../../_components/types";

// 承認済み運営者による施設情報の直接更新（即時反映）。書き込みはセッションクライアントで行い、
// RLS facility.is_owner（status='verified' のオーナー）/ 管理者のみ通る。キーは facilities の実カラム。
const schema = z.object({
  facility_id: z.string().uuid(),
  name: z.string().min(1, "施設名を入力してください").max(200),
  facility_type: z.string().max(60).optional(),
  description: z.string().max(2000).optional(),
  postal_code: z.string().max(16).optional(),
  prefecture: z.string().max(20).optional(),
  city: z.string().max(60).optional(),
  address: z.string().max(200).optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

export async function updateFacility(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/facilities");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const v = parsed.data;

  const lat = v.latitude && v.latitude.trim() !== "" ? Number(v.latitude) : null;
  const lng = v.longitude && v.longitude.trim() !== "" ? Number(v.longitude) : null;
  if ((lat != null && !Number.isFinite(lat)) || (lng != null && !Number.isFinite(lng))) {
    return { error: "緯度・経度は数値で入力してください" };
  }

  const patch: Record<string, unknown> = {
    name: v.name,
    facility_type: v.facility_type || null,
    description: v.description || null,
    postal_code: v.postal_code || null,
    prefecture: v.prefecture || null,
    city: v.city || null,
    address: v.address || null,
    latitude: lat,
    longitude: lng,
    updated_at: new Date().toISOString(),
  };
  // 緯度経度が揃っていれば近傍検索用の geog も更新（EWKT）。
  if (lat != null && lng != null) patch.geog = `SRID=4326;POINT(${lng} ${lat})`;

  // RLS が非オーナーの更新を 0 行に弾くため、更新行を返させて反映を確認する。
  const { data, error } = await supabase
    .schema(SCHEMA.facility)
    .from("facilities")
    .update(patch)
    .eq("id", v.facility_id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "更新権限がありません（承認済み運営者のみ編集できます）。" };

  revalidatePath(`/facilities/${v.facility_id}`);
  redirect(`/facilities/${v.facility_id}`);
}
