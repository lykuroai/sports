import { createAdminClient, SCHEMA } from "@spotomo/auth-client";

// =============================================================
// マラソン大会フィードの取り込み（定期バッチ）。
// 公式API/許諾フィード（RACE_FEED_URL）から「開催日が未来日」の大会を取得し、
// 取得済みデータ（running.races）と (source, source_id) で照合して
// 新規は追加・既存は更新する。サービスロールで実行（RLS バイパス）。
// =============================================================

export type FeedRace = {
  source_id: string;
  name: string;
  prefecture: string | null;
  city: string | null;
  event_date: string | null; // YYYY-MM-DD
  website_url: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type SyncSummary = {
  fetched: number;   // フィード総件数
  future: number;    // うち未来日（取り込み対象）
  inserted: number;  // 新規追加
  updated: number;   // 既存更新（内容に差分あり）
  unchanged: number; // 既存・差分なし
};

const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

const toDate = (v: unknown): string | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    // "YYYY-MM-DD" などはそのまま受ける。
    const s = String(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  return d.toISOString().slice(0, 10);
};

const toNum = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toStr = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** フィードの生 JSON を緩く正規化する（キー名の揺れを吸収）。 */
export function normalizeFeed(raw: unknown): FeedRace[] {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { races?: unknown[] })?.races)
      ? (raw as { races: unknown[] }).races
      : Array.isArray((raw as { data?: unknown[] })?.data)
        ? (raw as { data: unknown[] }).data
        : [];
  const out: FeedRace[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const source_id = toStr(pick(o, "source_id", "id", "race_id", "event_id"));
    const name = toStr(pick(o, "name", "title", "race_name"));
    if (!source_id || !name) continue; // キーと名称は必須
    out.push({
      source_id,
      name,
      prefecture: toStr(pick(o, "prefecture", "pref", "todofuken")),
      city: toStr(pick(o, "city", "municipality")),
      event_date: toDate(pick(o, "event_date", "date", "held_on", "start_date", "event_start")),
      website_url: toStr(pick(o, "website_url", "url", "website", "entry_url")),
      latitude: toNum(pick(o, "latitude", "lat")),
      longitude: toNum(pick(o, "longitude", "lng", "lon")),
    });
  }
  return out;
}

/** 公式API/許諾フィードを取得して正規化する。未設定なら例外。 */
export async function fetchFeed(): Promise<FeedRace[]> {
  const url = process.env.RACE_FEED_URL;
  if (!url) throw new Error("RACE_FEED_URL が設定されていません");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.RACE_FEED_KEY) headers.Authorization = `Bearer ${process.env.RACE_FEED_KEY}`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`フィード取得に失敗: HTTP ${res.status}`);
  return normalizeFeed(await res.json());
}

const FIELDS = ["name", "prefecture", "city", "event_date", "website_url", "latitude", "longitude"] as const;

/**
 * 未来日の大会を upsert する。新規は insert、既存（同一 source_id）は差分があれば update。
 * source は出所識別子（既定はフィード用 'feed'。env RACE_FEED_SOURCE で上書き可）。
 */
export async function syncRaces(rows: FeedRace[]): Promise<SyncSummary> {
  const source = process.env.RACE_FEED_SOURCE || "feed";
  const today = new Date().toISOString().slice(0, 10);
  const future = rows.filter((r) => r.event_date && r.event_date >= today);

  const admin = createAdminClient();
  const db = admin.schema(SCHEMA.running).from("races");

  // 既存（同一 source）を取得して source_id で索引。
  const { data: existingRows, error: selErr } = await db
    .select("id, source_id, name, prefecture, city, event_date, website_url, latitude, longitude")
    .eq("source", source);
  if (selErr) throw new Error(`既存データ取得に失敗: ${selErr.message}`);
  const existing = new Map<string, Record<string, unknown>>();
  for (const e of existingRows ?? []) existing.set(String(e.source_id), e);

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];
  let unchanged = 0;
  const now = new Date().toISOString();

  for (const r of future) {
    const cur = existing.get(r.source_id);
    if (!cur) {
      toInsert.push({ source, source_id: r.source_id, last_synced_at: now, ...pickFields(r) });
      continue;
    }
    const changed = FIELDS.some((f) => normalize(cur[f]) !== normalize((r as Record<string, unknown>)[f]));
    if (changed) {
      toUpdate.push({ id: String(cur.id), patch: { ...pickFields(r), last_synced_at: now } });
    } else {
      unchanged++;
    }
  }

  if (toInsert.length) {
    const { error } = await db.insert(toInsert);
    if (error) throw new Error(`新規追加に失敗: ${error.message}`);
  }
  for (const u of toUpdate) {
    const { error } = await db.update(u.patch).eq("id", u.id);
    if (error) throw new Error(`更新に失敗(${u.id}): ${error.message}`);
  }

  return {
    fetched: rows.length,
    future: future.length,
    inserted: toInsert.length,
    updated: toUpdate.length,
    unchanged,
  };
}

function pickFields(r: FeedRace): Record<string, unknown> {
  return {
    name: r.name,
    prefecture: r.prefecture,
    city: r.city,
    event_date: r.event_date,
    website_url: r.website_url,
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

const normalize = (v: unknown) => (v === null || v === undefined ? "" : String(v));
