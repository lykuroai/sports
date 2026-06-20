// 楽天GORA API クライアント（サーバー専用：API ルートとサーバーコンポーネントからのみ import）。
// - APIキーはサーバー側の環境変数のみ。フロントには公開しない（仕様 §10.2）。
// - 未設定なら configured=false を返し、API は呼ばない（ローカル/未契約での安全動作）。
// - 料金・空き枠は変動するため Next の fetch キャッシュで短時間キャッシュ（仕様 §12）。
// マッピングは楽天Web Service 公式ドキュメントのレスポンス仕様（formatVersion=2）に準拠:
//   GoraGolfCourseSearch: https://webservice.rakuten.co.jp/documentation/gora-golf-course-search
//   GoraPlanSearch:       https://webservice.rakuten.co.jp/documentation/gora-plan-search
// ※ GORA は applicationId に加え accessKey が必須。

const BASE = () =>
  process.env.RAKUTEN_GORA_API_BASE_URL ?? "https://app.rakuten.co.jp/services/api";
const APP_ID = () => process.env.RAKUTEN_APPLICATION_ID ?? "";
const ACCESS_KEY = () => process.env.RAKUTEN_ACCESS_KEY ?? "";
const AFFILIATE_ID = () => process.env.RAKUTEN_AFFILIATE_ID ?? "";

// エンドポイントのバージョンは公式ドキュメントの最新に追従すること（古い版は廃止され得る）。
const COURSE_SEARCH_PATH = "Gora/GoraGolfCourseSearch/20170623";
const PLAN_SEARCH_PATH = "Gora/GoraPlanSearch/20170915";

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

/** formatVersion=2 では配列要素は素のオブジェクト。旧形式（{Item:{...}} 等）にも対応。 */
function asRows(v: unknown, wrapKey?: string): Row[] {
  if (!Array.isArray(v)) return [];
  return v.map((el) => {
    const o = el as Row;
    if (wrapKey && o[wrapKey] && typeof o[wrapKey] === "object") return o[wrapKey] as Row;
    // v1 互換: 単一キーラッパ（{ Item: {...} } / { plan: {...} } / { cal: {...} }）。
    return o;
  });
}

function topItems(json: unknown): Row[] {
  return asRows((json as { Items?: unknown })?.Items, "Item");
}

/** 住所の先頭から都道府県を推定（コース検索は prefecture を返さないため）。 */
function prefFromAddress(address: string | null): string | null {
  if (!address) return null;
  const m = address.match(/^(.+?[都道府県])/);
  return m ? m[1] : null;
}

async function callGora(path: string, params: Record<string, string>, revalidate: number): Promise<unknown> {
  const url = new URL(`${BASE()}/${path}`);
  url.searchParams.set("applicationId", APP_ID());
  url.searchParams.set("accessKey", ACCESS_KEY());
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");
  if (AFFILIATE_ID()) url.searchParams.set("affiliateId", AFFILIATE_ID());
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);

  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`GORA API ${res.status}`);
  return res.json();
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
        keyword: params.keyword ?? "",
        areaCode: params.areaCode ?? "",
        latitude: params.latitude ?? "",
        longitude: params.longitude ?? "",
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
        reserveUrl,
        raw: { course: { golfCourseId: courseId, golfCourseName: courseName }, plan: p },
      });
    }
  }
  return out;
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
    return { configured: true, items: [], error: e instanceof Error ? e.message : "GORA API error" };
  }
}
