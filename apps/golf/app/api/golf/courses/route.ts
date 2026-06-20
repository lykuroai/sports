import { NextResponse } from "next/server";
import { searchCourses } from "../../../../lib/gora";

export const runtime = "nodejs";

// GET /api/golf/courses — 楽天GORA ゴルフ場検索（キーはサーバー側のみ）。
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const result = await searchCourses({
    keyword: sp.get("keyword") ?? undefined,
    prefecture: sp.get("prefecture") ?? undefined,
    areaCode: sp.get("areaCode") ?? undefined,
    latitude: sp.get("latitude") ?? undefined,
    longitude: sp.get("longitude") ?? undefined,
    page: sp.get("page") ? Number(sp.get("page")) : undefined,
  });
  return NextResponse.json(result);
}
