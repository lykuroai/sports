#!/usr/bin/env node
// 楽天GORA ゴルフ場の画像（golfCourseImageUrl）を facility.facility_images へバックフィルする。
//
// 背景: partner_api 取り込みのゴルフ場（facility_sources.source_type='rakuten_gora'、
// source_id=GORAコースID）は画像URLを保存していないため、Web の施設一覧/詳細で画像が出ない。
// GoraGolfCourseSearch を areaCode(1..47) でページングして courseId→imageUrl を集め、
// 画像未登録の該当施設へ facility_images を1枚 insert する。
//
// 実行: node scripts/backfill-gora-images.js [--area=13] [--dry]
//   --area  対象 areaCode のみ（カンマ区切り可）。省略で 1..47 全件。
//   --dry   DB へは書き込まず件数のみ表示。
// env は .env.production から読む（SUPABASE_*, RAKUTEN_APPLICATION_ID/ACCESS_KEY, REFERER）。
const fs = require("fs");
const path = require("path");
const https = require("node:https");
const { createClient } = require("@supabase/supabase-js");

// --- env 読み込み（.env.production の素朴パース） ---
const envPath = path.join(__dirname, "..", ".env.production");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const areaArg = (args.find((a) => a.startsWith("--area=")) || "").split("=")[1];
const AREAS = areaArg ? areaArg.split(",").map(Number) : Array.from({ length: 47 }, (_, i) => i + 1);

const APP_ID = process.env.RAKUTEN_APPLICATION_ID;
const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const REFERER = process.env.RAKUTEN_GORA_REFERER || process.env.NEXT_PUBLIC_GOLF_URL || "https://golf-spotomo.lykuro.ai/";
const BASE = process.env.RAKUTEN_GORA_API_BASE_URL || "https://openapi.rakuten.co.jp/engine/api";
const COURSE_SEARCH_PATH = "Gora/GoraGolfCourseSearch/20170623";
const HITS = 30;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "facility" },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const originOf = (r) => { try { return new URL(r).origin; } catch { return r; } };

function goraSearch(areaCode, page) {
  const url = new URL(`${BASE}/${COURSE_SEARCH_PATH}`);
  url.searchParams.set("applicationId", APP_ID);
  url.searchParams.set("accessKey", ACCESS_KEY);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");
  url.searchParams.set("areaCode", String(areaCode));
  url.searchParams.set("hits", String(HITS));
  url.searchParams.set("page", String(page));
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "GET",
      headers: { Referer: REFERER, Origin: originOf(REFERER), Accept: "application/json", "User-Agent": "spotomo-backfill/1.0" },
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(new Error("JSON parse: " + data.slice(0, 200))); }
        } else reject(new Error(`HTTP ${res.statusCode} ${data.slice(0, 200)}`));
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

// 429（レート制限）時は待って数回リトライ。
async function goraSearchRetry(area, page, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { return await goraSearch(area, page); }
    catch (e) {
      if (/HTTP 429/.test(e.message) && i < tries - 1) { await sleep(1500 * (i + 1)); continue; }
      throw e;
    }
  }
}

async function main() {
  if (!APP_ID || !ACCESS_KEY) throw new Error("RAKUTEN keys 未設定");

  // 1) facility_sources(rakuten_gora) から courseId→facility_id を構築。
  const courseToFacility = new Map(); // courseId -> facility_id
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from("facility_sources")
      .select("facility_id, source_id")
      .eq("source_type", "rakuten_gora")
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) if (r.source_id && r.facility_id) courseToFacility.set(String(r.source_id), r.facility_id);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`rakuten_gora 出所: ${courseToFacility.size} コース`);

  // 2) 既に画像を持つ facility を除外。
  const withImage = new Set();
  from = 0;
  for (;;) {
    const { data, error } = await sb.from("facility_images").select("facility_id").range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) withImage.add(r.facility_id);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`画像保有済み facility: ${withImage.size}`);

  // 3) areaCode ごとに course search をページング、画像URLを収集して未登録施設へ insert。
  let inserted = 0, imagesFound = 0, noMatch = 0, apiErrors = 0;
  for (const area of AREAS) {
    let page = 1, pageCount = 1;
    do {
      let json;
      try { json = await goraSearchRetry(area, page); }
      catch (e) { apiErrors++; console.warn(`  area=${area} page=${page} APIエラー: ${e.message}`); break; }
      // formatVersion=2 のルート配列は大文字 Items（小文字 items/ラッパ Item にも防御的対応）。
      const rawItems = Array.isArray(json.Items) ? json.Items : Array.isArray(json.items) ? json.items : [];
      const items = rawItems.map((el) => (el && (el.Item || el.item)) || el);
      const count = Number(json.count) || items.length;
      const hits = Number(json.hits) || HITS;
      pageCount = Number(json.pageCount) || (hits > 0 ? Math.max(1, Math.ceil(count / hits)) : 1);

      for (const it of items) {
        const courseId = it.golfCourseId != null ? String(it.golfCourseId) : null;
        const imageUrl = typeof it.golfCourseImageUrl === "string" && it.golfCourseImageUrl ? it.golfCourseImageUrl : null;
        if (!courseId || !imageUrl) continue;
        imagesFound++;
        const facilityId = courseToFacility.get(courseId);
        if (!facilityId) { noMatch++; continue; }
        if (withImage.has(facilityId)) continue;
        if (!dry) {
          const { error } = await sb.from("facility_images").insert({ facility_id: facilityId, url: imageUrl, display_order: 0 });
          if (error) { console.warn(`  insert失敗 ${facilityId}: ${error.message}`); continue; }
        }
        withImage.add(facilityId); // 同バッチ内重複防止
        inserted++;
      }
      page++;
      await sleep(1500); // レート制限緩和（GORA は ~1 req/s）
    } while (page <= pageCount);
    console.log(`area=${area} 完了 / 画像挿入累計=${inserted}`);
  }

  console.log(`\n=== 完了 ===`);
  console.log(`GORA画像あり: ${imagesFound} / 未マッチ(course→facility無): ${noMatch} / APIエラー: ${apiErrors}`);
  console.log(`facility_images へ${dry ? "（dry: 挿入予定）" : "挿入"}: ${inserted} 件`);
}

main().catch((e) => { console.error(e); process.exit(1); });
