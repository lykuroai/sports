import { NextResponse } from "next/server";
import { searchPlans } from "../../../../lib/gora";

export const runtime = "nodejs";

// GET /api/golf/plans — 楽天GORA プラン・空き枠検索。
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const courseId = sp.get("golfCourseId") ?? sp.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });
  const result = await searchPlans({
    courseId,
    playDate: sp.get("playDate") ?? undefined,
    priceMin: sp.get("priceMin") ?? undefined,
    priceMax: sp.get("priceMax") ?? undefined,
    startTimeZone: sp.get("startTimeZone") ?? undefined,
    lunch: sp.get("lunch") === "1",
    caddie: sp.get("caddie") === "1",
    cart: sp.get("cart") === "1",
    twoSum: sp.get("twoSum") === "1",
  });
  return NextResponse.json(result);
}
