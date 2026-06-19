"use server";

import { redirect } from "next/navigation";
import {
  createAdminClient,
  getAdminUser,
  writeAuditLog,
  SCHEMA,
} from "@spotomo/auth-client";

// facilities へ取り込める列のホワイトリスト（submitted_data / CSV 共通の原則）
const ALLOWED = [
  "name",
  "facility_type",
  "prefecture",
  "city",
  "address",
  "postal_code",
  "latitude",
  "longitude",
] as const;

export type ImportState = { error: string | null; imported?: number };

/** 簡易 CSV パーサ（ダブルクオート対応）。ヘッダ行必須。 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f !== "")) rows.push(row); }
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export async function importFacilitiesCsv(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const csv = String(formData.get("csv") ?? "");
  const parsed = parseCsv(csv);
  if (parsed.length === 0) return { error: "ヘッダ行＋1行以上のデータが必要です" };

  const records = parsed.map((r) => {
    const rec: Record<string, unknown> = { source: "csv_import" };
    for (const col of ALLOWED) {
      if (r[col] === undefined || r[col] === "") continue;
      rec[col] = col === "latitude" || col === "longitude" ? Number(r[col]) : r[col];
    }
    return rec;
  }).filter((r) => r.name);

  if (records.length === 0) return { error: "name 列が必要です（取り込める列: " + ALLOWED.join(", ") + "）" };

  const db = createAdminClient();
  const { error } = await db.schema(SCHEMA.facility).from("facilities").insert(records);
  if (error) return { error: error.message };

  await writeAuditLog(admin.id, "facility_csv_import", "facility", "bulk", "facility", { count: records.length });
  return { error: null, imported: records.length };
}
