#!/usr/bin/env node
// =============================================================
// 施設データ重複の一括統合ツール（一回限り・手動運用）
// 根拠: 依頼「現DBの施設データ重複を統合して（手動・ツールとしてバッチ作成）」
//
// 現DBの facility.facilities から重複レコードを検出し、存続側へ統合（merge_facilities
// RPC）する。安全のため既定はドライラン（検出と統合計画の表示のみ）。--apply で実行。
//
// 重複判定（保守的・誤統合を避ける）:
//   * normalized_name（DB の facility.normalize_name と同基準＝空白/法人格/ゴルフ場語尾除去）
//     が完全一致するレコードを同名グループにする。
//   * 同名グループ内で「座標が両方あれば半径 radius(m) 以内」または「座標欠落時は
//     都道府県+市区町村が一致」する施設だけを同一クラスタにまとめる（市民体育館など
//     同名・別所在地は統合しない）。
//   * 類似（あいまい）名の統合は対象外（管理画面の手動 merge に委ねる）。
//
// 存続側(keeper)の選定: verified 優先 → 出所(facility_sources)数が多い → 座標あり →
//   作成が古い、の順。欠損カラムは RPC 側で重複側から補完。
//
// 実行:
//   node --env-file=apps/web/.env.production scripts/dedup-facilities.mjs            # ドライラン
//   node --env-file=apps/web/.env.production scripts/dedup-facilities.mjs --apply    # 実統合
// オプション: --radius=200  --pref=東京都  --limit=100（統合実行の上限）
// 必須env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// =============================================================

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=").slice(1).join("=") : d;
};

const APPLY = has("--apply");
const RADIUS_M = Number(val("radius", "200"));
const PREF = val("pref", null);
const LIMIT = val("limit", null) ? Number(val("limit", null)) : Infinity;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。");
  console.error("例: node --env-file=apps/web/.env.production scripts/dedup-facilities.mjs");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const fac = supabase.schema("facility");

// ---- 全件ページ取得ヘルパー ----
async function fetchAll(table, columns) {
  const pageSize = 1000;
  let from = 0;
  const out = [];
  for (;;) {
    let q = fac.from(table).select(columns).range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error) throw new Error(`${table} 取得失敗: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

// ---- haversine 距離(m) ----
function distanceM(a, b) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 同一所在地か（座標があれば半径内、無ければ pref+city 一致）。
function sameLocality(a, b) {
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    return distanceM(a, b) <= RADIUS_M;
  }
  return !!a.city && a.prefecture === b.prefecture && a.city === b.city;
}

// union-find
function makeUF(n) {
  const p = Array.from({ length: n }, (_, i) => i);
  const find = (x) => (p[x] === x ? x : (p[x] = find(p[x])));
  const union = (a, b) => { p[find(a)] = find(b); };
  return { find, union };
}

function pickKeeper(cluster) {
  return [...cluster].sort((a, b) => {
    const v = (x) => (x.status === "verified" ? 1 : 0);
    if (v(b) !== v(a)) return v(b) - v(a);
    if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
    const c = (x) => (x.lat != null && x.lng != null ? 1 : 0);
    if (c(b) !== c(a)) return c(b) - c(a);
    return new Date(a.created_at) - new Date(b.created_at); // 古い方を残す
  })[0];
}

async function main() {
  console.log(`# 施設重複統合ツール（${APPLY ? "APPLY=実統合" : "DRY-RUN=計画のみ"}）`);
  console.log(`# radius=${RADIUS_M}m${PREF ? ` pref=${PREF}` : ""}${LIMIT !== Infinity ? ` limit=${LIMIT}` : ""}\n`);

  const facilities = await fetchAll(
    "facilities",
    "id, name, normalized_name, prefecture, city, latitude, longitude, status, created_at"
  );
  const sources = await fetchAll("facility_sources", "facility_id");
  const srcCount = new Map();
  for (const s of sources) srcCount.set(s.facility_id, (srcCount.get(s.facility_id) ?? 0) + 1);

  const rows = facilities
    .filter((f) => (PREF ? f.prefecture === PREF : true))
    .map((f) => ({
      id: f.id,
      name: f.name,
      norm: f.normalized_name,
      prefecture: f.prefecture,
      city: f.city,
      lat: f.latitude != null ? Number(f.latitude) : null,
      lng: f.longitude != null ? Number(f.longitude) : null,
      status: f.status,
      created_at: f.created_at,
      sourceCount: srcCount.get(f.id) ?? 0,
    }));

  // normalized_name でグループ化（null/空は対象外）。
  const byName = new Map();
  for (const r of rows) {
    if (!r.norm) continue;
    if (!byName.has(r.norm)) byName.set(r.norm, []);
    byName.get(r.norm).push(r);
  }

  // 同名グループ内を所在地でクラスタリング。
  const clusters = [];
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const uf = makeUF(group.length);
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++)
        if (sameLocality(group[i], group[j])) uf.union(i, j);
    const buckets = new Map();
    group.forEach((_, i) => {
      const root = uf.find(i);
      if (!buckets.has(root)) buckets.set(root, []);
      buckets.get(root).push(group[i]);
    });
    for (const b of buckets.values()) if (b.length >= 2) clusters.push(b);
  }

  console.log(`対象施設: ${rows.length} 件 / 重複クラスタ: ${clusters.length} 件 / 統合で削除予定: ${clusters.reduce((n, c) => n + c.length - 1, 0)} 件\n`);

  let merges = 0;
  let done = 0;
  let failed = 0;
  for (const cluster of clusters) {
    if (merges >= LIMIT) break;
    const keeper = pickKeeper(cluster);
    const losers = cluster.filter((c) => c.id !== keeper.id);
    console.log(`■ "${keeper.name}" [${keeper.prefecture ?? ""}${keeper.city ?? ""}]`);
    console.log(`  keep : ${keeper.id} (status=${keeper.status}, sources=${keeper.sourceCount})`);
    for (const l of losers) {
      console.log(`  drop : ${l.id} (status=${l.status}, sources=${l.sourceCount}) "${l.name}"`);
    }
    if (APPLY) {
      for (const l of losers) {
        if (merges >= LIMIT) break;
        const { error } = await fac.rpc("merge_facilities", { p_keep: keeper.id, p_drop: l.id });
        merges++;
        if (error) { failed++; console.log(`    ! 失敗 ${l.id}: ${error.message}`); }
        else { done++; }
      }
    } else {
      merges += losers.length;
    }
  }

  console.log("");
  if (APPLY) console.log(`完了: 統合 ${done} 件 / 失敗 ${failed} 件`);
  else console.log(`ドライラン完了。実行するには --apply を付けて再実行してください（統合予定 ${merges} 件）。`);
}

main().catch((e) => { console.error(e); process.exit(1); });
