import { createAdminClient, SCHEMA } from "@spotomo/auth-client";

// =============================================================
// 自治体オープンデータ（CKAN/CSV）施設取り込み（統合サイト化 Phase 3）
// 根拠: docs/仕様変更/sports_leisure_facility_data_design_v1_2.md (§8,§11)
//
// 自治体の公共スポーツ施設 CSV（CKAN リソース URL）を取得し、facility.facilities へ
// 取り込む。自治体ごとに列名・文字コード（多くは Shift_JIS）・ライセンスが異なるため、
// 列名は柔軟に推定し、文字コードは UTF-8→Shift_JIS の順で自動判定する。
//   * 出所は facility_sources に source_type='municipal_open_data'（URL/ライセンス/raw 行）。
//   * 重複は find_duplicate_candidates、自動取得＝status='unverified'（公開前承認）。
//   * 取得元とライセンスを必ず保存（再利用条件遵守・仕様 §5/§20.3/§22.3）。
// サービスロールで実行（RLS バイパス）。
// =============================================================

const MUNICIPAL_LICENSE_DEFAULT = "自治体オープンデータ（取得元の利用規約に従う）";

export type MunicipalRow = {
  sourceId: string;       // 行の一意キー（施設名+住所のハッシュ代替: name|address）
  name: string;
  facilityType: string | null;
  sportSlug: string | null;
  lat: number | null;
  lng: number | null;
  prefecture: string | null;
  city: string | null;
  address: string | null;
  raw: Record<string, string>;
};

export type MunicipalSyncSummary = {
  fetched: number; candidates: number; inserted: number; linked: number;
  updated: number; unchanged: number; skipped: number; errors: number;
};

// ---- CSV パース（RFC4180 風。引用符・改行・エスケープに対応）----
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v !== "")) rows.push(row); }
  return rows;
}

// ---- 文字コード自動判定（UTF-8 で化けたら Shift_JIS）----
export function decodeBytes(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  // BOM 付き UTF-8 or 置換文字が無ければ UTF-8 とみなす。
  if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
  try {
    return new TextDecoder("shift_jis").decode(buf);
  } catch {
    return utf8.replace(/^﻿/, "");
  }
}

// ---- 列名の柔軟マッチ ----
const norm = (s: string) => s.replace(/\s|　/g, "").toLowerCase();
// 「全国地方公共団体コード」「市区町村コード」等のコード列を都道府県/市区町村名と
// 誤認しないよう除外する。完全一致を優先し、無ければ部分一致（コード列は除く）。
function findCol(headers: string[], candidates: string[]): number {
  const H = headers.map(norm);
  const isCode = (h: string) => h.includes("コード") || h.includes("code");
  for (const cand of candidates) {
    const c = norm(cand);
    const i = H.findIndex((h) => h === c);
    if (i >= 0) return i;
  }
  for (const cand of candidates) {
    const c = norm(cand);
    const i = H.findIndex((h) => h.includes(c) && !isCode(h));
    if (i >= 0) return i;
  }
  return -1;
}

// 同名列が複数ある場合に全インデックスを返す（東京都推奨データセットは緯度/経度が
// 2組あり、片方が空のことがある。行ごとに非空を採用するため全列を見る）。
function findCols(headers: string[], candidates: string[]): number[] {
  const H = headers.map(norm);
  const isCode = (h: string) => h.includes("コード") || h.includes("code");
  const out: number[] = [];
  H.forEach((h, i) => {
    if (!isCode(h) && candidates.some((c) => h === norm(c) || h.includes(norm(c)))) out.push(i);
  });
  return out;
}
// 複数列から最初の非空セルを返す。
const pickCell = (cells: string[], cols: number[]): string | undefined => {
  for (const i of cols) { const v = cells[i]; if (v != null && v.trim() !== "") return v; }
  return undefined;
};

// 全国地方公共団体コード等（数字のみ）を都道府県/市区町村名として扱わない。
const nameOrNull = (v: string | null): string | null => (v && /^\d+$/.test(v) ? null : v);

// 住所の先頭から都道府県名を抽出（列・既定が無いソースのフォールバック）。
const PREF_RE = /(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;
const prefFromAddress = (addr: string | null): string | null => addr?.match(PREF_RE)?.[1] ?? null;

// 施設名/種別から代表 sport slug を推定（一致しなければ null）。
function inferSport(text: string): string | null {
  const t = text;
  if (/陸上競技|トラック|競技場/.test(t)) return "running";
  if (/プール|水泳/.test(t)) return "swimming";
  if (/テニス/.test(t)) return "tennis";
  if (/野球|球場/.test(t)) return "baseball";
  if (/サッカー|フットサル/.test(t)) return "soccer";
  if (/体育館|アリーナ|武道/.test(t)) return "fitness";
  if (/ランニング|ジョギング|マラソン/.test(t)) return "running";
  if (/公園/.test(t)) return "park-walk";
  return null;
}

const toNum = (v: string | undefined): number | null => {
  if (v == null) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) && n !== 0 ? n : null;
};
const toStr = (v: string | undefined): string | null => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

/** CSV テキストを取り込み候補へ正規化する。pref はファイル全体の都道府県既定。 */
export function normalizeMunicipalCsv(text: string, prefDefault: string | null): { rows: MunicipalRow[]; skipped: number } {
  const grid = parseCsv(text);
  if (grid.length < 2) return { rows: [], skipped: 0 };
  const headers = grid[0];
  const idx = {
    name: findCol(headers, ["施設名称", "施設名", "名称", "name", "施設"]),
    type: findCol(headers, ["施設種別", "種別", "区分", "分類", "カテゴリ", "type"]),
    // 緯度/経度は同名列が複数あり得る（東京都推奨DSは2組）。全列を見て非空を採用。
    lat: findCols(headers, ["緯度", "latitude"]),
    lng: findCols(headers, ["経度", "longitude"]),
    addr: findCol(headers, ["所在地_連結表記", "所在地", "住所", "address"]),
    pref: findCol(headers, ["所在地_都道府県", "都道府県", "prefecture"]),
    city: findCol(headers, ["所在地_市区町村", "市区町村", "市町村", "city"]),
  };
  const rows: MunicipalRow[] = [];
  let skipped = 0;
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const name = toStr(cells[idx.name]);
    const lat = toNum(pickCell(cells, idx.lat));
    const lng = toNum(pickCell(cells, idx.lng));
    if (!name || lat == null || lng == null) { skipped++; continue; }
    const facilityType = idx.type >= 0 ? toStr(cells[idx.type]) : null;
    const address = idx.addr >= 0 ? toStr(cells[idx.addr]) : null;
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => { if (cells[i] != null && cells[i] !== "") raw[h] = cells[i]; });
    rows.push({
      sourceId: `${name}|${address ?? ""}|${lat.toFixed(5)},${lng.toFixed(5)}`,
      name,
      facilityType: facilityType ?? "公共施設",
      sportSlug: inferSport(`${name} ${facilityType ?? ""}`),
      lat, lng,
      // 優先: 都道府県名列 > 指定既定(pref) > 住所先頭から抽出。
      prefecture: nameOrNull(idx.pref >= 0 ? toStr(cells[idx.pref]) : null) ?? prefDefault ?? prefFromAddress(address),
      city: nameOrNull(idx.city >= 0 ? toStr(cells[idx.city]) : null),
      address,
      raw,
    });
  }
  return { rows, skipped };
}

type Admin = ReturnType<typeof createAdminClient>;

async function loadSportIds(admin: Admin, slugs: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(slugs)];
  const { data } = await admin.schema(SCHEMA.core).from("sports").select("id, slug").in("slug", uniq);
  return new Map((data ?? []).map((r: { id: string; slug: string }) => [String(r.slug), String(r.id)]));
}

/** CKAN/CSV リソースを取得して取り込む。 */
export async function syncMunicipalFacilities(opts: {
  url: string; sourceName: string; license?: string; prefecture?: string | null;
}): Promise<MunicipalSyncSummary> {
  const admin = createAdminClient();
  const fac = admin.schema(SCHEMA.facility);
  const core = admin.schema(SCHEMA.core);

  const { data: run } = await core.from("batch_runs").insert({ job_name: "municipal_facility_fetch", status: "running" }).select("id").single();
  const runId = (run?.id as string) ?? null;
  const log = (level: string, message: string, detail?: unknown) =>
    runId ? core.from("batch_run_logs").insert({ batch_run_id: runId, level, message, detail: detail ?? null }) : Promise.resolve();

  const summary: MunicipalSyncSummary = { fetched: 0, candidates: 0, inserted: 0, linked: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0 };
  try {
    const res = await fetch(opts.url, {
      headers: { "User-Agent": process.env.OSM_USER_AGENT || "Spotomo/1.0 (+https://spotomo.lykuro.ai)" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`CSV 取得に失敗: HTTP ${res.status}`);
    const text = decodeBytes(await res.arrayBuffer());
    const { rows, skipped } = normalizeMunicipalCsv(text, opts.prefecture ?? null);
    summary.fetched = rows.length + skipped;
    summary.candidates = rows.length;
    summary.skipped = skipped;
    await log("info", `${opts.sourceName} rows=${rows.length} skipped=${skipped}`);

    const limit = Number(process.env.MUNICIPAL_FETCH_LIMIT) || 500;
    const sportIds = await loadSportIds(admin, rows.map((r) => r.sportSlug).filter((s): s is string => !!s));
    const license = opts.license || MUNICIPAL_LICENSE_DEFAULT;

    for (const f of rows.slice(0, limit)) {
      try {
        const { data: existingSrc } = await fac
          .from("facility_sources")
          .select("id, facility_id")
          .eq("source_type", "municipal_open_data")
          .eq("source_id", f.sourceId)
          .maybeSingle();
        if (existingSrc?.facility_id) {
          await fac.from("facility_sources").update({ raw_data: f.raw, fetched_at: new Date().toISOString() }).eq("id", existingSrc.id);
          summary.unchanged++;
          continue;
        }

        const { data: dups } = await fac.rpc("find_duplicate_candidates", {
          p_name: f.name, p_lat: f.lat, p_lng: f.lng, p_radius_m: 150, p_lim: 5,
        });
        const top = (dups ?? [])[0] as { id: string; name_sim: number | null; distance_m: number | null } | undefined;
        const isDup = top && ((top.name_sim ?? 0) > 0.6 || (top.distance_m != null && top.distance_m < 80));
        if (isDup && top) {
          await fac.from("facility_sources").insert({
            facility_id: top.id, source_type: "municipal_open_data", source_id: f.sourceId,
            source_name: opts.sourceName, source_url: opts.url, license, raw_data: f.raw,
          });
          summary.linked++;
          continue;
        }

        const { data: inserted, error: insErr } = await fac.from("facilities").insert({
          name: f.name, facility_type: f.facilityType, prefecture: f.prefecture, city: f.city, address: f.address,
          latitude: f.lat, longitude: f.lng, geog: `SRID=4326;POINT(${f.lng} ${f.lat})`,
          source: "opendata", status: "unverified", last_checked_at: new Date().toISOString(),
        }).select("id").single();
        if (insErr || !inserted) throw new Error(insErr?.message ?? "insert 失敗");
        const facilityId = inserted.id as string;
        const sportId = f.sportSlug ? sportIds.get(f.sportSlug) : undefined;
        if (sportId) await fac.from("facility_sports").insert({ facility_id: facilityId, sport_id: sportId });
        await fac.from("facility_sources").insert({
          facility_id: facilityId, source_type: "municipal_open_data", source_id: f.sourceId,
          source_name: opts.sourceName, source_url: opts.url, license, raw_data: f.raw,
        });
        summary.inserted++;
      } catch (e) {
        summary.errors++;
        await log("error", `取り込み失敗: ${f.name}`, { message: e instanceof Error ? e.message : String(e) });
      }
    }
    if (runId) await core.from("batch_runs").update({
      status: summary.errors > 0 ? "partial" : "success", finished_at: new Date().toISOString(),
      total_count: summary.candidates, success_count: summary.inserted + summary.linked + summary.unchanged, failed_count: summary.errors,
    }).eq("id", runId);
    return summary;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (runId) await core.from("batch_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: message }).eq("id", runId);
    throw e;
  }
}
