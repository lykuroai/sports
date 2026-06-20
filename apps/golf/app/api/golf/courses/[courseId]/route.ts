import { NextResponse } from "next/server";
import { getCourse } from "../../../../../lib/gora";

export const runtime = "nodejs";

// GET /api/golf/courses/{courseId} — 楽天GORA ゴルフ場詳細。
export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ course });
}
