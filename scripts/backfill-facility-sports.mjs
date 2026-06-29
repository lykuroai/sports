#!/usr/bin/env node
// =============================================================
// 種目未付与施設への種目バックフィル（一回限り・手動運用）
// 根拠: 依頼「おすすめ施設が『施設を探す』で出ない＝種目(facility_sports)未付与の既存
//       施設に種目を付ける」。取り込みバッチの種目必須化は今後分のみに効くため、既存
//       データ（約1,394件）を一括補完する。
//
// facility_sports が1件も無い施設を対象に、施設名・種別から代表種目(小分類)を推定し、
// 「小分類＋大分類」を付与する（検索 /facilities は facility_sports!inner で絞るため、
// 小分類だけでも親カテゴリ選択でヒットするが、表示・整合のため親も付ける）。推定不能は
// 「その他のスポーツ＋大分類その他」へフォールバックし、最低限検索可能にする。
//
// 既定はドライラン（推定の内訳表示のみ）。--apply で実付与。
// 実行: node --env-file=/opt/spotomo/.env.production scripts/backfill-facility-sports.mjs
//       node --env-file=/opt/spotomo/.env.production scripts/backfill-facility-sports.mjs --apply
// オプション: --status=verified（対象を限定。既定は全status）  --limit=N
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
const STATUS = val("status", null);
const LIMIT = val("limit", null) ? Number(val("limit", null)) : Infinity;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。"); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });
const fac = supabase.schema("facility");

// 施設名・種別から代表 sport slug（小分類）を推定。municipal-sync の inferSport を拡張。
function inferSport(text) {
  const t = text;
  if (/ゴルフ|ｺﾞﾙﾌ|golf|カントリー|ｶﾝﾄﾘｰ|country|\bGC\b|\bCC\b|倶楽部|パークゴルフ|グラウンドゴルフ|グラウンド・ゴルフ/i.test(t)) return "golf";
  if (/陸上競技|トラック|競技場/.test(t)) return "running";
  if (/プール|水泳|スイミング/.test(t)) return "swimming";
  if (/テニス/.test(t)) return "tennis";
  if (/野球|球場|ベースボール/.test(t)) return "baseball";
  if (/サッカー|フットサル|フットボール/.test(t)) return "soccer";
  if (/バスケット/.test(t)) return "basketball";
  if (/バレーボール/.test(t)) return "volleyball";
  if (/卓球/.test(t)) return "table-tennis";
  if (/バドミントン/.test(t)) return "badminton";
  if (/体育館|アリーナ|スポーツセンター|武道|柔道|剣道|総合運動/.test(t)) return "fitness";
  if (/ヨガ/.test(t)) return "yoga";
  if (/ボウリング/.test(t)) return "bowling";
  if (/ランニング|ジョギング|マラソン/.test(t)) return "running";
  if (/スキー|スノーボード|スノボ|ゲレンデ/.test(t)) return "ski";
  if (/キャンプ|オートキャンプ|グランピング/.test(t)) return "camping";
  if (/釣り|フィッシング|渓流|管理釣場|釣り場/.test(t)) return "fishing";
  if (/海水浴/.test(t)) return "sea-bathing";
  if (/サーフィン/.test(t)) return "surfing";
  if (/登山|山岳/.test(t)) return "mountaineering";
  if (/ハイキング|ハイク/.test(t)) return "hiking";
  if (/サイクリング|自転車|サイクル/.test(t)) return "cycling";
  if (/バーベキュー|ＢＢＱ|\bBBQ\b/i.test(t)) return "bbq";
  if (/公園|緑地|広場|園地|庭園|運動場/.test(t)) return "park-walk";
  return null;
}

async function loadSportTree() {
  const { data } = await supabase.schema("core").from("sports").select("id, slug, parent_id");
  const bySlug = new Map();
  for (const r of data ?? []) bySlug.set(r.slug, { id: r.id, parentId: r.parent_id });
  const other = bySlug.get("other-sports");
  const catOther = bySlug.get("cat-other");
  return { bySlug, fallback: { childId: other?.id ?? null, parentId: catOther?.id ?? other?.parentId ?? null } };
}
function resolveIds(tree, slug) {
  const node = slug ? tree.bySlug.get(slug) : undefined;
  let childId, parentId;
  if (node) { childId = node.id; parentId = node.parentId ?? node.id; }
  else { childId = tree.fallback.childId; parentId = tree.fallback.parentId; }
  return [...new Set([childId, parentId].filter(Boolean))];
}

async function pageAll(table, columns, build) {
  const pageSize = 1000; let from = 0; const out = [];
  for (;;) {
    let q = fac.from(table).select(columns).range(from, from + pageSize - 1);
    if (build) q = build(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function main() {
  console.log(`# 種目バックフィル（${APPLY ? "APPLY=実付与" : "DRY-RUN=内訳のみ"}）${STATUS ? ` status=${STATUS}` : ""}${LIMIT !== Infinity ? ` limit=${LIMIT}` : ""}\n`);
  const tree = await loadSportTree();

  const facilities = await pageAll("facilities", "id, name, facility_type, status",
    (q) => (STATUS ? q.eq("status", STATUS) : q));
  const linked = new Set();
  (await pageAll("facility_sports", "facility_id")).forEach((r) => linked.add(r.facility_id));

  const targets = facilities.filter((f) => !linked.has(f.id));
  console.log(`対象(${STATUS ?? "全status"})施設: ${facilities.length} / 種目なし: ${targets.length}\n`);

  const dist = new Map();
  let inferred = 0, fallback = 0;
  const plan = [];
  for (const f of targets) {
    const slug = inferSport(`${f.name} ${f.facility_type ?? ""}`);
    const ids = resolveIds(tree, slug);
    if (slug) inferred++; else fallback++;
    dist.set(slug ?? "(その他)", (dist.get(slug ?? "(その他)") ?? 0) + 1);
    plan.push({ id: f.id, ids });
  }

  console.log("推定内訳:");
  for (const [k, v] of [...dist.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(14)} ${v}`);
  console.log(`\n推定成功 ${inferred} / フォールバック(その他) ${fallback}\n`);

  if (!APPLY) { console.log("実付与するには --apply を付けて再実行してください。"); return; }

  let done = 0, failed = 0, n = 0;
  for (const p of plan) {
    if (n >= LIMIT) break;
    n++;
    const rows = p.ids.map((sport_id) => ({ facility_id: p.id, sport_id }));
    const { error } = await fac.from("facility_sports").upsert(rows, { onConflict: "facility_id,sport_id", ignoreDuplicates: true });
    if (error) { failed++; if (failed <= 10) console.log(`  ! 失敗 ${p.id}: ${error.message}`); }
    else done++;
  }
  console.log(`\n完了: 付与 ${done} 件 / 失敗 ${failed} 件`);
}

main().catch((e) => { console.error(e); process.exit(1); });
