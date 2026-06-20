// 楽天GORA API クライアント（サーバー専用：API ルートとサーバーコンポーネントからのみ import）。
// - APIキーはサーバー側の環境変数のみ。フロントには公開しない（仕様 §10.2）。
// - 未設定なら configured=false を返し、API は呼ばない（ローカル/未契約での安全動作）。
// - 楽天ゲートウェイは登録リファラ必須。ただし fetch(undici) は Referer を「禁止ヘッダ」
//   として黙って落とすため、node:https で明示送出する（fetch では常に REFERRER_MISSING）。
// - レート制限緩和のためプロセス内 TTL キャッシュを持つ。
// マッピングは楽天Web Service 公式ドキュメントのレスポンス仕様（formatVersion=2）に準拠:
//   GoraGolfCourseSearch: https://webservice.rakuten.co.jp/documentation/gora-golf-course-search
//   GoraPlanSearch:       https://webservice.rakuten.co.jp/documentation/gora-plan-search
// ※ GORA は applicationId に加え accessKey が必須。
import https from "node:https";

const BASE = () =>
  process.env.RAKUTEN_GORA_API_BASE_URL ?? "https://openapi.rakuten.co.jp/engine/api";
const APP_ID = () => process.env.RAKUTEN_APPLICATION_ID ?? "";
const ACCESS_KEY = () => process.env.RAKUTEN_ACCESS_KEY ?? "";
const AFFILIATE_ID = () => process.env.RAKUTEN_AFFILIATE_ID ?? "";
// 楽天ゲートウェイは登録済みリファラ必須。サーバー fetch は Referer を自動付与しないため明示送出する。
const REFERER = () =>
  process.env.RAKUTEN_GORA_REFERER ?? process.env.NEXT_PUBLIC_GOLF_URL ?? "https://golf-spotomo.lykuro.ai/";
// affiliateId を使うと登録リファラ必須になり 403 になりやすい。リファラ登録が確認できるまでは
// 既定で affiliate 無し（= 実証済みで成功する最小構成）。RAKUTEN_GORA_USE_AFFILIATE=1 で有効化。
const USE_AFFILIATE = () => process.env.RAKUTEN_GORA_USE_AFFILIATE === "1" && Boolean(AFFILIATE_ID());

// エンドポイントのバージョンは公式ドキュメントの最新に追従すること（古い版は廃止され得る）。
const COURSE_SEARCH_PATH = "Gora/GoraGolfCourseSearch/20170623";
const PLAN_SEARCH_PATH = "Gora/GoraPlanSearch/20170623";

// GORA は applicationId と accessKey の双方が必須。
export function isGoraConfigured(): boolean {
  return Boolean(APP_ID() && ACCESS_KEY());
}

export interface GoraCourse {
  courseId: string;
  name: string;
  prefecture: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  imageUrl: string | null;
  detailUrl: string | null;
  reserveUrl: string | null;
  highway: string | null;
  caption: string | null;
}

export interface GoraPlan {
  courseId: string;
  courseName: string | null;
  planId: string;
  planName: string;
  playDate: string | null; // YYYY-MM-DD
  startTimeZone: string | null;
  price: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  lunchIncluded: boolean | null;
  caddieIncluded: boolean | null;
  cartType: string | null;
  twoSumGuaranteed: boolean | null;
  threeBExtraFee: number | null;
  cancelFeeFlag: boolean | null;
  cancelFeeDescription: string | null;
  stockCount: number | null;
  reserveUrl: string | null;
  raw: unknown;
}

export interface GoraResult<T> {
  configured: boolean;
  items: T[];
  error?: string;
}

export interface CourseSearchParams {
  keyword?: string;
  prefecture?: string;
  areaCode?: string;
  latitude?: string;
  longitude?: string;
  sort?: string; // rating（既定）/ evaluation / reservation など
  page?: number;
}

export interface PlanSearchParams {
  courseId: string;
  playDate?: string; // YYYY-MM-DD（未指定は当日）
  priceMin?: string;
  priceMax?: string;
  startTimeZone?: string;
  lunch?: boolean;
  caddie?: boolean;
  cart?: boolean;
  twoSum?: boolean;
}

type Row = Record<string, unknown>;
const str = (v: unknown): string | null =>
  typeof v === "string" && v !== "" ? v : typeof v === "number" ? String(v) : null;
const num = (v: unknown): number | null =>
  typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null;
// GORA のフラグは int(0|1)。1 を true とみなす。
const flag = (v: unknown): boolean | null => {
  const n = num(v);
  return n == null ? null : n >= 1;
};

/**
 * formatVersion=2 では配列要素は素のオブジェクト。formatVersion=1 は { item: {...} } 等の
 * 単一キーラッパで包まれる。公式のキーは小文字（item/plan/cal）だが大文字にも防御的に対応。
 */
function asRows(v: unknown, wrapKey?: string): Row[] {
  if (!Array.isArray(v)) return [];
  const cap = wrapKey ? wrapKey.charAt(0).toUpperCase() + wrapKey.slice(1) : "";
  return v.map((el) => {
    const o = el as Row;
    if (wrapKey) {
      const w = o[wrapKey] ?? o[cap];
      if (w && typeof w === "object") return w as Row;
    }
    return o;
  });
}

/** ルート配列は公式仕様では小文字 items（旧実装の Items 大文字にもフォールバック）。 */
function topItems(json: unknown): Row[] {
  const root = json as { items?: unknown; Items?: unknown };
  return asRows(root?.items ?? root?.Items, "item");
}

/** 住所の先頭から都道府県を推定（コース検索は prefecture を返さないため）。 */
function prefFromAddress(address: string | null): string | null {
  if (!address) return null;
  const m = address.match(/^(.+?[都道府県])/);
  return m ? m[1] : null;
}

function buildUrl(path: string, params: Record<string, string>, withAffiliate: boolean): URL {
  const url = new URL(`${BASE()}/${path}`);
  url.searchParams.set("applicationId", APP_ID());
  url.searchParams.set("accessKey", ACCESS_KEY());
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");
  if (withAffiliate && AFFILIATE_ID()) url.searchParams.set("affiliateId", AFFILIATE_ID());
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url;
}

function originOf(referer: string): string {
  try {
    return new URL(referer).origin; // scheme+host（末尾スラッシュ/パスなし）
  } catch {
    return referer;
  }
}

// node:https で GET（fetch と違い Referer/Origin 禁止ヘッダを確実に送れる）。
// 楽天ゲートウェイは Origin（登録アプリURLのスキーム+ホスト）で検査するため Origin も送る。
function httpGet(url: URL, referer: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          Referer: referer,
          Origin: originOf(referer),
          Accept: "application/json",
          "User-Agent": "spotomo-golf/1.0",
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("error", reject);
    req.setTimeout(10_000, () => req.destroy(new Error("GORA timeout")));
    req.end();
  });
}

// プロセス内 TTL キャッシュ（料金・空き枠の頻繁な再取得とレート制限を緩和）。
const cache = new Map<string, { at: number; json: unknown }>();

async function callGora(path: string, params: Record<string, string>, ttlSec: number): Promise<unknown> {
  const ref = REFERER();
  const tryOnce = async (withAffiliate: boolean): Promise<{ ok: true; json: unknown } | { ok: false; status: number; body: string }> => {
    const url = buildUrl(path, params, withAffiliate);
    const key = url.toString();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlSec * 1000) return { ok: true, json: hit.json };
    const res = await httpGet(url, ref);
    if (res.status >= 200 && res.status < 300) {
      const json = JSON.parse(res.body);
      cache.set(key, { at: Date.now(), json });
      return { ok: true, json };
    }
    return { ok: false, status: res.status, body: res.body };
  };

  // affiliate 有効時のみ affiliate 付きで先に試行（収益リンク）。失敗したら affiliate 無しへ。
  if (USE_AFFILIATE()) {
    const a = await tryOnce(true);
    if (a.ok) return a.json;
  }
  const r = await tryOnce(false);
  if (r.ok) return r.json;
  throw new Error(`GORA API ${r.status} ${path} ${r.body.slice(0, 200)}`);
}

// ---- ゴルフ場検索 ----
function mapCourse(r: Row): GoraCourse | null {
  const courseId = str(r.golfCourseId);
  const name = str(r.golfCourseName);
  if (!courseId || !name) return null;
  const address = str(r.address);
  return {
    courseId,
    name,
    prefecture: prefFromAddress(address),
    address,
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    rating: num(r.evaluation),
    imageUrl: str(r.golfCourseImageUrl),
    detailUrl: str(r.golfCourseDetailUrl),
    reserveUrl: str(r.reserveCalUrl) ?? str(r.golfCourseDetailUrl),
    highway: str(r.highway),
    caption: str(r.golfCourseCaption),
  };
}

export async function searchCourses(params: CourseSearchParams): Promise<GoraResult<GoraCourse>> {
  if (!isGoraConfigured()) return { configured: false, items: [] };
  try {
    const json = await callGora(
      COURSE_SEARCH_PATH,
      {
        // GORA は keyword / areaCode / 緯度経度 のいずれか必須。都道府県のみ指定時は
        // 都道府県名を keyword として送る（結果は下の prefecture で住所絞り込みも行う）。
        keyword: params.keyword || params.prefecture || "",
        areaCode: params.areaCode ?? "",
        latitude: params.latitude ?? "",
        longitude: params.longitude ?? "",
        sort: params.sort ?? "",
        page: params.page ? String(params.page) : "",
      },
      86_400, // ゴルフ場基本情報は1日キャッシュ
    );
    let items = topItems(json).map(mapCourse).filter((c): c is GoraCourse => c !== null);
    // 都道府県は API で直接絞れないため住所ベースでクライアント側絞り込み。
    if (params.prefecture) {
      const kw = params.prefecture;
      items = items.filter((c) => (c.address ?? "").includes(kw) || (c.prefecture ?? "").includes(kw));
    }
    return { configured: true, items };
  } catch (e) {
    console.error("[gora] searchCourses failed:", e instanceof Error ? e.message : e);
    return { configured: true, items: [], error: e instanceof Error ? e.message : "GORA API error" };
  }
}

export async function getCourse(courseId: string): Promise<GoraCourse | null> {
  if (!isGoraConfigured()) return null;
  try {
    const json = await callGora(COURSE_SEARCH_PATH, { golfCourseId: courseId }, 86_400);
    const items = topItems(json).map(mapCourse).filter((c): c is GoraCourse => c !== null);
    return items.find((c) => c.courseId === courseId) ?? items[0] ?? null;
  } catch {
    return null;
  }
}

// ---- プラン・空き枠検索 ----
// プラン検索はコース単位の入れ子（コース直下に planInfo[] と calInfo[]）。
// 各プラン × そのコースの予約URL/プレー日に展開して GoraPlan の配列にする。
function flattenPlans(json: unknown, fallbackDate: string): GoraPlan[] {
  const out: GoraPlan[] = [];
  for (const course of topItems(json)) {
    const courseId = str(course.golfCourseId);
    if (!courseId) continue;
    const courseName = str(course.golfCourseName);
    const cals = asRows(course.calInfo, "cal");
    const firstCal = cals[0];
    const playDate = (firstCal && str(firstCal.playDate)) ?? fallbackDate;
    const stockCount = firstCal ? num(firstCal.stockCount) : null;
    const reserveUrl =
      (firstCal && (str(firstCal.reservePageUrlPC) ?? str(firstCal.reservePageUrlMobile))) ??
      str(course.reserveCalUrlPC) ??
      str(course.reserveCalUrl);
    const cancelFeeFlag = flag(course.cancelFeeFlag);
    const cancelFeeAmount = num(course.cancelFee);

    for (const p of asRows(course.planInfo, "plan")) {
      const planId = str(p.planId);
      const planName = str(p.planName);
      if (!planId || !planName) continue;
      const cart = num(p.cart);
      out.push({
        courseId,
        courseName,
        planId,
        planName,
        playDate,
        startTimeZone: str(p.startTimeZone),
        price: num(p.price),
        minPlayers: num(p.playerNumMin),
        maxPlayers: num(p.playerNumMax),
        lunchIncluded: flag(p.lunch),
        caddieIncluded: flag(p.caddie),
        cartType: cart != null && cart >= 1 ? "カートあり" : null,
        twoSumGuaranteed: flag(p.assu2sum),
        threeBExtraFee: num(p.addFee3b),
        cancelFeeFlag,
        cancelFeeDescription: cancelFeeAmount != null ? `${cancelFeeAmount.toLocaleString()}円` : null,
        stockCount,
        reserveUrl,
        raw: { course: { golfCourseId: courseId, golfCourseName: courseName }, plan: p },
      });
    }
  }
  return out;
}

/**
 * 当該コースの最安プラン料金（一覧カードの「〜円」表示用）。コース検索APIは料金を
 * 返さないため、表示中の上位コースのみプラン検索で取得する想定。失敗時は null。
 */
export async function getLowestPrice(courseId: string, playDate?: string): Promise<number | null> {
  const res = await searchPlans({ courseId, playDate });
  const prices = res.items.map((p) => p.price).filter((n): n is number => n != null && n > 0);
  return prices.length ? Math.min(...prices) : null;
}

export async function searchPlans(params: PlanSearchParams): Promise<GoraResult<GoraPlan>> {
  if (!isGoraConfigured()) return { configured: false, items: [] };
  // playDate は必須。未指定は当日。
  const playDate = params.playDate ?? new Date().toISOString().slice(0, 10);
  try {
    const json = await callGora(
      PLAN_SEARCH_PATH,
      {
        golfCourseId: params.courseId,
        playDate,
        minPrice: params.priceMin ?? "",
        maxPrice: params.priceMax ?? "",
        startTimeZone: params.startTimeZone ?? "",
        planLunch: params.lunch ? "1" : "",
        planCaddie: params.caddie ? "1" : "",
        planCart: params.cart ? "1" : "",
        plan2sum: params.twoSum ? "1" : "",
      },
      900, // プラン・空き枠は短時間（15分）キャッシュ
    );
    return { configured: true, items: flattenPlans(json, playDate) };
  } catch (e) {
    console.error("[gora] searchPlans failed:", e instanceof Error ? e.message : e);
    return { configured: true, items: [], error: e instanceof Error ? e.message : "GORA API error" };
  }
}
