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

const createSchema = z.object({
  name: z.string().min(1).max(60),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, "slug は英小文字・数字・ハイフン"),
  category_type: z.enum(["sports", "outdoor"]),
  display_order: z.coerce.number().int().min(0).default(0),
});

export type SportState = { error: string | null };

export async function createSport(_prev: SportState, formData: FormData): Promise<SportState> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const db = createAdminClient();
  const { data, error } = await db.schema(SCHEMA.core).from("sports").insert(parsed.data).select("id").single();
  if (error) return { error: error.message };

  await writeAuditLog(admin.id, "sport_create", "sport", data.id, "core", { slug: parsed.data.slug });
  revalidatePath("/sports");
  return { error: null };
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
