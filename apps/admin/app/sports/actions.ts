"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createAdminClient,
  getAdminUser,
  writeAuditLog,
  SCHEMA,
} from "@spotomo/auth-client";

// 大分類/小分類は core.sports の parent_id で表す（2階層まで）。
// 親(parent_id)を指定すれば小分類、未指定なら大分類。区分(category_type)は小分類では親から継承する。
const createSchema = z.object({
  name: z.string().min(1).max(60),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, "slug は英小文字・数字・ハイフン"),
  display_order: z.coerce.number().int().min(0).default(0),
});

export type SportState = { error: string | null };

export async function createSport(_prev: SportState, formData: FormData): Promise<SportState> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const parentId = String(formData.get("parent_id") ?? "").trim() || null;

  const db = createAdminClient();
  let categoryType: string;
  if (parentId) {
    // 小分類: 親（大分類）の存在と「親が大分類であること（2階層まで）」を検証し、区分を継承。
    const { data: parent } = await db
      .schema(SCHEMA.core).from("sports").select("category_type, parent_id").eq("id", parentId).maybeSingle();
    if (!parent) return { error: "親カテゴリ（大分類）が見つかりません" };
    if ((parent as { parent_id: string | null }).parent_id) return { error: "小分類の下に小分類は作成できません（2階層まで）" };
    categoryType = (parent as { category_type: string }).category_type;
  } else {
    // 大分類: 区分を必須にする。
    const ct = String(formData.get("category_type") ?? "");
    if (ct !== "sports" && ct !== "outdoor") return { error: "区分を選択してください" };
    categoryType = ct;
  }

  const { data, error } = await db
    .schema(SCHEMA.core).from("sports")
    .insert({ ...parsed.data, category_type: categoryType, parent_id: parentId })
    .select("id").single();
  if (error) return { error: error.message };

  await writeAuditLog(admin.id, "sport_create", "sport", data.id, "core", { slug: parsed.data.slug, parent_id: parentId });
  revalidatePath("/sports");
  return { error: null };
}

// 大分類⇄小分類の付け替え。parent_id="" で大分類化、親id指定で小分類化（区分は親から継承）。
// 2階層を保つため、親が小分類のものや、子を持つ大分類の小分類化は拒否する。
export async function setSportParent(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const id = String(formData.get("id"));
  const parentId = String(formData.get("parent_id") ?? "").trim() || null;
  if (!id || parentId === id) return;

  const db = createAdminClient();
  const patch: Record<string, unknown> = { parent_id: parentId };

  if (parentId) {
    // 親候補が大分類であること（小分類は親にできない）。
    const { data: parent } = await db
      .schema(SCHEMA.core).from("sports").select("category_type, parent_id").eq("id", parentId).maybeSingle();
    if (!parent) return;
    if ((parent as { parent_id: string | null }).parent_id) return;
    // 自分が子を持つ大分類なら小分類化しない（子が孫になり 3 階層化するため）。
    const { count } = await db
      .schema(SCHEMA.core).from("sports").select("id", { count: "exact", head: true }).eq("parent_id", id);
    if ((count ?? 0) > 0) return;
    patch.category_type = (parent as { category_type: string }).category_type;
  }

  await db.schema(SCHEMA.core).from("sports").update(patch).eq("id", id);
  await writeAuditLog(admin.id, "sport_set_parent", "sport", id, "core", { parent_id: parentId });
  revalidatePath("/sports");
}

export async function toggleSportStatus(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const id = String(formData.get("id"));
  const next = String(formData.get("status")) === "published" ? "published" : "unpublished";

  const db = createAdminClient();
  await db.schema(SCHEMA.core).from("sports").update({ status: next }).eq("id", id);
  await writeAuditLog(admin.id, "sport_status", "sport", id, "core", { status: next });
  revalidatePath("/sports");
}

export async function reorderSport(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const id = String(formData.get("id"));
  const order = Number(formData.get("display_order")) || 0;

  const db = createAdminClient();
  await db.schema(SCHEMA.core).from("sports").update({ display_order: order }).eq("id", id);
  await writeAuditLog(admin.id, "sport_reorder", "sport", id, "core", { display_order: order });
  revalidatePath("/sports");
}
