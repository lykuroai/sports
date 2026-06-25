import { NextResponse } from "next/server";
import { syncOsmFacilities } from "@/lib/osm-sync";

export const runtime = "nodejs";
// Overpass 取得→重複判定→upsert に時間がかかるため動的・キャッシュ無効。
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 定期バッチ: OpenStreetMap / Overpass からランニング/公園系施設を取得し、
// facility.facilities へ取り込む（重複判定つき・未承認で登録）。
// cron から CRON_SECRET 付きで叩く想定。area は都道府県名（既定 OSM_FETCH_AREA / 東京都）。
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET 未設定" }, { status: 500 });

  const auth = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  const ok = auth === `Bearer ${secret}` || headerSecret === secret;
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const area = url.searchParams.get("area") || process.env.OSM_FETCH_AREA || "東京都";

  try {
    const summary = await syncOsmFacilities(area);
    return NextResponse.json({ ok: true, area, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ ok: false, area, error: message }, { status: 502 });
  }
}

export const POST = handle;
// cron サービスによっては GET しか叩けないため両対応。
export const GET = handle;
