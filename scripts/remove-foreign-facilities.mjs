#!/usr/bin/env node
// =============================================================
// 韓国語（ハングル）混入施設の除去ツール（一回限り・手動運用）
// 根拠: 依頼「施設データに韓国文字が混じった。取り除いて」。OSM の対馬付近 bbox から
//   誤って取り込まれた韓国の施設（公園等）が存在する。現行の取り込みは isLikelyForeign で
//   ハングル名を除外済み（再混入しない）。既存の混入分のみ削除する。
//
// 対象: name / address / city / prefecture のいずれかにハングルを含む施設。
//   削除は facilities を delete（子テーブルは ON DELETE CASCADE で消える）。
// 既定はドライラン（一覧表示のみ）。--apply で削除実行。
// 実行: node --env-file=/opt/spotomo/.env.production scripts/remove-foreign-facilities.mjs
//       node --env-file=/opt/spotomo/.env.production scripts/remove-foreign-facilities.mjs --apply
// 必須env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// =============================================================

import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。"); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });
const fac = supabase.schema("facility");

// ハングル（音節 + 字母）。日本語・漢字は対象外。
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏ꥠ-꥿ힰ-퟿]/;

async function main() {
  console.log(`# 韓国語混入施設の除去（${APPLY ? "APPLY=削除" : "DRY-RUN=一覧のみ"}）\n`);
  const pageSize = 1000; let from = 0; const all = [];
  for (;;) {
    const { data, error } = await fac.from("facilities").select("id, name, prefecture, city, address").range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  const hit = all.filter((f) => [f.name, f.address, f.city, f.prefecture].some((v) => v && HANGUL.test(v)));
  console.log(`全施設 ${all.length} / ハングル含む ${hit.length}\n`);
  hit.forEach((f) => console.log(`  ${f.id} | ${f.name} | ${(f.prefecture ?? "")}${(f.city ?? "")} | ${f.address ?? ""}`));
  console.log("");

  if (hit.length === 0) { console.log("対象なし。"); return; }
  if (!APPLY) { console.log(`削除するには --apply を付けて再実行してください（削除予定 ${hit.length} 件）。`); return; }

  const ids = hit.map((f) => f.id);
  let deleted = 0, failed = 0;
  // 100件ずつ delete（子は cascade）。
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error } = await fac.from("facilities").delete().in("id", chunk);
    if (error) { failed += chunk.length; console.log(`  ! 失敗: ${error.message}`); }
    else deleted += chunk.length;
  }
  console.log(`\n完了: 削除 ${deleted} 件 / 失敗 ${failed} 件`);
}

main().catch((e) => { console.error(e); process.exit(1); });
