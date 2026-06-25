import { createAdminClient, SCHEMA } from "@spotomo/auth-client";

// =============================================================
// OpenStreetMap / Overpass API 施設取り込み（定期バッチ・統合サイト化 Phase 3）
// 根拠: docs/仕様変更/sports_leisure_facility_data_design_v1_2.md (§7,§11,§14,§15)
//
// ランニング/公園系の OSM POI（陸上トラック・ランニングコース・運動公園・スタジアム）を
// Overpass で取得し、自社 facility.facilities へ取り込む。
//   * 出所は facility.facility_sources に source_type='openstreetmap' で記録（raw tags + 帰属）。
//   * 同一 OSM 要素の再取得は (source_type, source_id) ユニークで冪等。
//   * 既存施設との重複は RPC facility.find_duplicate_candidates で判定し、強一致なら
//     新規作成せず既存施設へ出所行のみ付与（リンク）。
//   * 自動取得データは status='unverified'（公開前承認）で登録し、施設一覧には出さない。
// サービスロールで実行（RLS バイパス）。OSM は ODbL のため帰属表示（© OpenStreetMap
// contributors）が必要 — license 列に記録し、施設詳細での表示は別途。
// =============================================================

// 既定は area DB 不要・到達性の良い OSM France 公式インスタンス（bbox クエリ前提）。
const OVERPASS_DEFAULT = "https://overpass.openstreetmap.fr/api/interpreter";
const OSM_LICENSE = "ODbL 1.0 (© OpenStreetMap contributors)";

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OsmFacility = {
  osmId: string;          // "way/123"
  name: string;
  sportSlug: string;      // core.sports.slug
  facilityType: string;   // 表示用ラベル
  lat: number;
  lng: number;
  prefecture: string | null;
  city: string | null;
  address: string | null;
  tags: Record<string, string>;
};

export type OsmSyncSummary = {
  fetched: number;    // Overpass 取得要素数
  candidates: number; // 名前あり・取り込み対象
  inserted: number;   // 新規施設
  linked: number;     // 既存施設へ出所付与（重複と判定）
  updated: number;    // 既存 OSM 由来施設の更新
  unchanged: number;
  skipped: number;    // 名前なし等で除外
  errors: number;
};

// OSM タグ → 自社カテゴリ（sport slug / 表示ラベル）。ランニング先行のマッピング。
function classify(tags: Record<string, string>): { sportSlug: string; facilityType: string } | null {
  const leisure = tags.leisure;
  const sport = tags.sport ?? "";
  if (leisure === "track") return { sportSlug: "running", facilityType: "陸上競技場・トラック" };
  if (leisure === "pitch" && /running|athletics/.test(sport)) return { sportSlug: "running", facilityType: "陸上競技場・トラック" };
  if (leisure === "stadium" && /running|athletics/.test(sport)) return { sportSlug: "running", facilityType: "競技場" };
  if (leisure === "sports_centre" && /running|athletics/.test(sport)) return { sportSlug: "running", facilityType: "スポーツセンター" };
  if (leisure === "park") return { sportSlug: "park-walk", facilityType: "公園" };
  return null;
}

// 都道府県の境界ボックス（south,west,north,east）。Overpass の area 機能は
// 一部ミラー（overpass.openstreetmap.fr 等）に area DB が無く使えないため、
// area 名ではなく bbox で取得する（全インスタンスで動作）。離島は概ね除外。
// 必要な都道府県のみ随時追加。未知の area は OSM_FETCH_BBOX で上書きするか東京既定。
export type Bbox = readonly [number, number, number, number];
// 値は [south, west, north, east]。全47都道府県（Nominatim 由来の県境界 bbox）。
// 隣接県と境界部でわずかに重なるが、同一 OSM 要素は (source_type,source_id) で冪等。
// 東京都は公式 bbox が小笠原・南鳥島(154°E)まで広がり全国に重なるため本土へクリップ。
export const PREFECTURE_BBOX: Record<string, Bbox> = {
  "北海道": [41.152, 139.067, 45.711, 145.916],
  "青森県": [40.218, 139.234, 41.606, 141.904],
  "岩手県": [38.748, 140.653, 40.56, 142.332],
  "宮城県": [37.773, 140.275, 39.003, 142.051],
  "秋田県": [38.873, 139.343, 40.511, 140.995],
  "山形県": [37.734, 139.138, 39.593, 140.646],
  "福島県": [36.744, 139.165, 37.989, 141.438],
  "茨城県": [35.739, 139.688, 36.945, 141.031],
  "栃木県": [36.2, 139.327, 37.155, 140.292],
  "群馬県": [35.985, 138.397, 37.059, 139.67],
  "埼玉県": [35.754, 138.711, 36.283, 139.9],
  "千葉県": [34.617, 139.518, 36.104, 141.125],
  "東京都": [35.50, 138.94, 35.95, 139.95],
  "神奈川県": [34.957, 138.916, 35.673, 139.858],
  "新潟県": [36.737, 137.532, 38.897, 139.9],
  "富山県": [36.274, 136.768, 37.253, 137.763],
  "石川県": [36.067, 136.082, 38.135, 137.865],
  "福井県": [35.344, 135.449, 36.451, 136.832],
  "山梨県": [35.168, 138.18, 35.972, 139.134],
  "長野県": [35.198, 137.325, 37.03, 138.739],
  "岐阜県": [35.134, 136.276, 36.465, 137.653],
  "静岡県": [34.372, 137.474, 35.646, 139.421],
  "愛知県": [34.276, 136.671, 35.425, 137.838],
  "三重県": [33.613, 135.853, 35.258, 137.326],
  "滋賀県": [34.791, 135.764, 35.704, 136.455],
  "京都府": [34.706, 134.851, 36.15, 136.055],
  "大阪府": [34.272, 135.026, 35.051, 135.747],
  "兵庫県": [34.012, 134.253, 35.875, 135.469],
  "奈良県": [33.859, 135.54, 34.781, 136.23],
  "和歌山県": [33.233, 134.88, 34.394, 136.322],
  "鳥取県": [35.058, 133.136, 35.803, 134.515],
  "島根県": [34.302, 131.462, 36.556, 133.638],
  "岡山県": [34.252, 133.267, 35.353, 134.413],
  "広島県": [34.008, 132.036, 35.106, 133.497],
  "山口県": [33.553, 130.398, 35.078, 132.511],
  "徳島県": [33.331, 133.661, 34.366, 134.987],
  "香川県": [34.012, 133.357, 34.629, 134.596],
  "愛媛県": [32.786, 131.88, 34.32, 133.693],
  "高知県": [32.384, 132.213, 33.883, 134.542],
  "福岡県": [32.94, 129.813, 34.647, 131.249],
  "佐賀県": [32.918, 129.64, 33.705, 130.542],
  "長崎県": [31.785, 127.869, 34.892, 130.482],
  "熊本県": [32.009, 129.322, 33.195, 131.33],
  "大分県": [32.379, 130.825, 33.846, 132.276],
  "宮崎県": [31.252, 130.703, 32.839, 132.206],
  "鹿児島県": [26.839, 128.205, 32.329, 131.316],
  "沖縄県": [23.846, 122.714, 28.086, 131.554],
};

/** area（都道府県名）から bbox を解決。OSM_FETCH_BBOX(csv) > マップ > 東京既定。 */
export function resolveBbox(area: string): Bbox {
  const csv = process.env.OSM_FETCH_BBOX;
  if (csv) {
    const p = csv.split(",").map((s) => Number(s.trim()));
    if (p.length === 4 && p.every((n) => Number.isFinite(n))) return p as unknown as Bbox;
  }
  return PREFECTURE_BBOX[area] ?? PREFECTURE_BBOX["東京都"];
}

/** Overpass のクエリ文字列を組み立てる（bbox 指定。area DB に依存しない）。 */
export function buildOverpassQuery(bbox: Bbox): string {
  const b = `(${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]})`;
  // 大きな県の bbox でも取得しきれるよう timeout を長め（fetch 側は maxDuration 300s）。
  return `[out:json][timeout:180];
(
  nwr["leisure"="track"]${b};
  nwr["leisure"="pitch"]["sport"~"running|athletics"]${b};
  nwr["leisure"="stadium"]["sport"~"running|athletics"]${b};
  nwr["leisure"="sports_centre"]["sport"~"running|athletics"]${b};
  nwr["leisure"="park"]${b};
);
out center tags;`;
}

/** Overpass を叩いて生要素を取得する。area は都道府県名（bbox に解決）。 */
export async function fetchOverpass(area: string): Promise<OsmElement[]> {
  const url = process.env.OSM_OVERPASS_URL || OVERPASS_DEFAULT;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Overpass/OSM 利用ポリシー上、識別可能な User-Agent が必須（無いと 406/429 で弾かれる）。
      "User-Agent": process.env.OSM_USER_AGENT || "Spotomo/1.0 (+https://spotomo.lykuro.ai)",
      Accept: "application/json",
    },
    body: "data=" + encodeURIComponent(buildOverpassQuery(resolveBbox(area))),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Overpass 取得に失敗: HTTP ${res.status}`);
  const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
  // Overpass はサーバ側エラー（タイムアウト等）を 200＋remark で返すことがある。
  if ((!json.elements || json.elements.length === 0) && json.remark) {
    throw new Error(`Overpass remark: ${json.remark}`);
  }
  return json.elements ?? [];
}

/** 生要素を取り込み候補へ正規化（名前・座標・分類が揃うもののみ）。 */
export function normalizeOsm(elements: OsmElement[], area: string): { facilities: OsmFacility[]; skipped: number } {
  const out: OsmFacility[] = [];
  let skipped = 0;
  const areaIsPref = /[都道府県]$/.test(area);
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = (tags.name ?? "").trim();
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const cls = classify(tags);
    if (!name || lat == null || lng == null || !cls) {
      skipped++;
      continue;
    }
    out.push({
      osmId: `${el.type}/${el.id}`,
      name,
      sportSlug: cls.sportSlug,
      facilityType: cls.facilityType,
      lat,
      lng,
      prefecture: tags["addr:province"] ?? (areaIsPref ? area : null),
      city: tags["addr:city"] ?? null,
      address: tags["addr:full"] ?? null,
      tags,
    });
  }
  return { facilities: out, skipped };
}

type Admin = ReturnType<typeof createAdminClient>;

async function startRun(admin: Admin, jobName: string): Promise<string | null> {
  const { data } = await admin
    .schema(SCHEMA.core)
    .from("batch_runs")
    .insert({ job_name: jobName, status: "running" })
    .select("id")
    .single();
  return (data?.id as string) ?? null;
}

async function finishRun(admin: Admin, runId: string | null, status: string, s: OsmSyncSummary, error?: string) {
  if (!runId) return;
  await admin
    .schema(SCHEMA.core)
    .from("batch_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      total_count: s.candidates,
      success_count: s.inserted + s.linked + s.updated + s.unchanged,
      failed_count: s.errors,
      error_message: error ?? null,
    })
    .eq("id", runId);
}

async function log(admin: Admin, runId: string | null, level: string, message: string, detail?: unknown) {
  if (!runId) return;
  await admin
    .schema(SCHEMA.core)
    .from("batch_run_logs")
    .insert({ batch_run_id: runId, level, message, detail: detail ?? null });
}

/** sport slug → core.sports.id の対応表を取得。 */
async function loadSportIds(admin: Admin, slugs: string[]): Promise<Map<string, string>> {
  const { data } = await admin.schema(SCHEMA.core).from("sports").select("id, slug").in("slug", slugs);
  const m = new Map<string, string>();
  for (const r of data ?? []) m.set(String(r.slug), String(r.id));
  return m;
}

/**
 * 正規化済み施設を取り込む。冪等・重複判定つき。
 * area はログ用途。jobName は batch_runs 用。
 */
export async function ingestOsmFacilities(
  facilities: OsmFacility[],
  fetched: number,
  skipped: number,
  area: string,
): Promise<OsmSyncSummary> {
  const admin = createAdminClient();
  const fac = admin.schema(SCHEMA.facility);
  const summary: OsmSyncSummary = {
    fetched, candidates: facilities.length, inserted: 0, linked: 0, updated: 0, unchanged: 0, skipped, errors: 0,
  };
  const runId = await startRun(admin, "osm_facility_fetch");
  await log(admin, runId, "info", `Overpass area=${area} fetched=${fetched} candidates=${facilities.length}`);

  const limit = Number(process.env.OSM_FETCH_LIMIT) || 300;
  const sportIds = await loadSportIds(admin, ["running", "park-walk"]);

  for (const f of facilities.slice(0, limit)) {
    try {
      // 1) 同一 OSM 要素の既存出所を確認（冪等）
      const { data: existingSrc } = await fac
        .from("facility_sources")
        .select("id, facility_id")
        .eq("source_type", "openstreetmap")
        .eq("source_id", f.osmId)
        .maybeSingle();

      if (existingSrc?.facility_id) {
        // 既存 OSM 由来施設 → 基本情報の差分を更新し、出所の raw を更新
        const patch: Record<string, unknown> = {
          name: f.name,
          facility_type: f.facilityType,
          latitude: f.lat,
          longitude: f.lng,
          geog: `SRID=4326;POINT(${f.lng} ${f.lat})`,
        };
        const { data: cur } = await fac
          .from("facilities")
          .select("name, facility_type, latitude, longitude")
          .eq("id", existingSrc.facility_id)
          .maybeSingle();
        const changed = cur && (cur.name !== f.name || cur.facility_type !== f.facilityType
          || Number(cur.latitude) !== f.lat || Number(cur.longitude) !== f.lng);
        if (changed) {
          await fac.from("facilities").update(patch).eq("id", existingSrc.facility_id);
          summary.updated++;
        } else {
          summary.unchanged++;
        }
        await fac.from("facility_sources").update({
          raw_data: f.tags, fetched_at: new Date().toISOString(), source_url: `https://www.openstreetmap.org/${f.osmId}`,
        }).eq("id", existingSrc.id);
        continue;
      }

      // 2) 既存施設との重複判定（名称類似 or 近接）
      const { data: dups } = await fac.rpc("find_duplicate_candidates", {
        p_name: f.name, p_lat: f.lat, p_lng: f.lng, p_radius_m: 100, p_lim: 5,
      });
      const top = (dups ?? [])[0] as { id: string; name_sim: number | null; distance_m: number | null } | undefined;
      const isDup = top && ((top.name_sim ?? 0) > 0.6 || (top.distance_m != null && top.distance_m < 50));

      if (isDup && top) {
        // 既存施設へ出所のみ付与（自動統合はせず、出所として紐づけ）
        await fac.from("facility_sources").insert({
          facility_id: top.id, source_type: "openstreetmap", source_id: f.osmId,
          source_name: f.name, source_url: `https://www.openstreetmap.org/${f.osmId}`,
          license: OSM_LICENSE, raw_data: f.tags,
        });
        summary.linked++;
        continue;
      }

      // 3) 新規施設（自動取得＝未承認）。geog は EWKT で投入し近傍検索を有効化。
      const { data: inserted, error: insErr } = await fac.from("facilities").insert({
        name: f.name,
        facility_type: f.facilityType,
        prefecture: f.prefecture,
        city: f.city,
        address: f.address,
        latitude: f.lat,
        longitude: f.lng,
        geog: `SRID=4326;POINT(${f.lng} ${f.lat})`,
        source: "opendata",
        status: "unverified",
        last_checked_at: new Date().toISOString(),
      }).select("id").single();
      if (insErr || !inserted) throw new Error(insErr?.message ?? "insert 失敗");

      const facilityId = inserted.id as string;
      const sportId = sportIds.get(f.sportSlug);
      if (sportId) {
        await fac.from("facility_sports").insert({ facility_id: facilityId, sport_id: sportId });
      }
      await fac.from("facility_sources").insert({
        facility_id: facilityId, source_type: "openstreetmap", source_id: f.osmId,
        source_name: f.name, source_url: `https://www.openstreetmap.org/${f.osmId}`,
        license: OSM_LICENSE, raw_data: f.tags,
      });
      summary.inserted++;
    } catch (e) {
      summary.errors++;
      await log(admin, runId, "error", `取り込み失敗: ${f.osmId} ${f.name}`, {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await finishRun(admin, runId, summary.errors > 0 ? "partial" : "success", summary);
  return summary;
}

/** area（都道府県名）を指定して Overpass 取得→取り込みまで一括実行。 */
export async function syncOsmFacilities(area: string): Promise<OsmSyncSummary> {
  const elements = await fetchOverpass(area);
  const { facilities, skipped } = normalizeOsm(elements, area);
  return ingestOsmFacilities(facilities, elements.length, skipped, area);
}
