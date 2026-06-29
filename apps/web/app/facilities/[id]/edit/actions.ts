"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { resolveFacilityImageUrl } from "@spotomo/domain-common";
import type { SubmitState } from "../../_components/types";
import { fetchSportNodes } from "../../../../lib/category";

// 承認済み運営者による施設情報の直接更新（即時反映）。書き込みはセッションクライアントで行い、
// RLS facility.is_owner（status='verified' のオーナー）/ 管理者のみ通る。キーは facilities の実カラム。
// 種別は大分類(sport_parent)/小分類(sport_child)で受け、facility_sports に展開する。
const schema = z.object({
  facility_id: z.string().uuid(),
  name: z.string().min(1, "施設名を入力してください").max(200),
  sport_parent: z.string().min(1, "種別（大分類）を選択してください"),
  sport_child: z.string().optional().or(z.literal("")),
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

  // 種別（大分類/小分類）を検証。表示用 facility_type は選択した種目名にする。
  const nodes = await fetchSportNodes(supabase);
  const parent = nodes.find((n) => n.id === v.sport_parent && !n.parent_id);
  if (!parent) return { error: "種別（大分類）の選択が正しくありません" };
  const child = v.sport_child ? nodes.find((n) => n.id === v.sport_child && n.parent_id === parent.id) : undefined;
  if (v.sport_child && !child) return { error: "種別（小分類）の選択が正しくありません" };
  const sportIds = child ? [parent.id, child.id] : [parent.id];

  const patch: Record<string, unknown> = {
    name: v.name,
    facility_type: (child ?? parent).name,
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

  // 種目（大分類＋小分類）を入れ替える。RLS fac_sports_write は is_owner で通る。
  await supabase.schema(SCHEMA.facility).from("facility_sports").delete().eq("facility_id", v.facility_id);
  await supabase.schema(SCHEMA.facility).from("facility_sports")
    .insert(sportIds.map((sport_id) => ({ facility_id: v.facility_id, sport_id })));

  revalidatePath(`/facilities/${v.facility_id}`);
  redirect(`/facilities/${v.facility_id}`);
}

// 施設画像の追加（URL方式・アップロードなし）。承認済み運営者のみ（RLS fac_images_write）。
export async function addFacilityImage(formData: FormData): Promise<void> {
  const facilityId = String(formData.get("facility_id"));
  const input = String(formData.get("url") ?? "").trim();
  if (!facilityId || !/^https?:\/\//i.test(input)) {
    redirect(`/facilities/${facilityId}/edit?img_error=1`);
  }
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 画像URLならそのまま、ページURLなら og:image 等を抽出して採用。
  const url = await resolveFacilityImageUrl(input);
  if (!url) redirect(`/facilities/${facilityId}/edit?img_error=1`);

  const fac = supabase.schema(SCHEMA.facility);
  const { data: max } = await fac
    .from("facility_images")
    .select("display_order")
    .eq("facility_id", facilityId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((max?.display_order as number | null) ?? -1) + 1;
  await fac.from("facility_images").insert({ facility_id: facilityId, url, display_order: nextOrder });
  revalidatePath(`/facilities/${facilityId}/edit`);
  revalidatePath(`/facilities/${facilityId}`);
}

// 施設画像の削除。
export async function deleteFacilityImage(formData: FormData): Promise<void> {
  const facilityId = String(formData.get("facility_id"));
  const imageId = String(formData.get("image_id"));
  if (!facilityId || !imageId) return;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.schema(SCHEMA.facility).from("facility_images").delete().eq("id", imageId);
  revalidatePath(`/facilities/${facilityId}/edit`);
  revalidatePath(`/facilities/${facilityId}`);
}
