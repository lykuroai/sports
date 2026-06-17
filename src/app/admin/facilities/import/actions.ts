"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser, writeAuditLog } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCsv } from "@/lib/csv";

// CSV ヘッダーとして許可するカラム（facilities の列名）
const ALLOWED = [
  "name",
  "facility_type",
  "postal_code",
  "prefecture",
  "city",
  "address",
  "latitude",
  "longitude",
  "nearest_station",
  "access_description",
  "phone",
  "website_url",
  "reservation_url",
  "price_description",
  "holiday_description",
] as const;

export type ImportState = { error: string | null; inserted?: number; skipped?: number };

export async function importFacilitiesCsv(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "管理者権限が必要です" };

  const csv = ((formData.get("csv") as string) ?? "").trim();
  if (!csv) return { error: "CSVを入力してください" };

  const rows = parseCsv(csv);
  if (rows.length === 0) return { error: "データ行がありません" };

  const db = createAdminClient();
  const records: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (!row.name) {
      skipped++;
      continue;
    }
    const rec: Record<string, unknown> = {
      source_type: "csv_import",
      verification_status: "verified",
      last_confirmed_at: new Date().toISOString(),
    };
    for (const key of ALLOWED) {
      const v = row[key];
      if (v === undefined || v === "") continue;
      if (key === "latitude" || key === "longitude") {
        const n = Number(v);
        if (!Number.isNaN(n)) rec[key] = n;
      } else {
        rec[key] = v;
      }
    }
    records.push(rec);
  }

  if (records.length === 0) return { error: "登録可能な行がありませんでした（name 必須）", skipped };

  // 緯度経度→geom はトリガーで自動設定される
  const { error, count } = await db.from("facilities").insert(records, { count: "exact" });
  if (error) return { error: `取り込みに失敗しました: ${error.message}`, skipped };

  await writeAuditLog(admin.id, "facility.csv_import", "facility", "bulk", {
    inserted: count ?? records.length,
    skipped,
  });
  revalidatePath("/admin/facilities/import");
  return { error: null, inserted: count ?? records.length, skipped };
}
