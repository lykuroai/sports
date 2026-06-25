import { NextResponse } from "next/server";
import { syncMunicipalFacilities } from "@/lib/municipal-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 定期バッチ: 自治体オープンデータ（CKAN/CSV）の公共スポーツ施設を取り込む。
// 取り込み元 CSV は自治体ごとに異なるため、URL/出所名/ライセンス/都道府県を指定する。
//   ?url=...（必須）&source=...（出所名）&license=...&pref=都道府県
// 単一URLずつ叩く想定（自治体ごとにライセンス・列が異なるため）。CRON_SECRET 認証。
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET 未設定" }, { status: 500 });
  const auth = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  if (!(auth === `Bearer ${secret}` || headerSecret === secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const u = new URL(req.url);
  const url = u.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url パラメータが必要です" }, { status: 400 });
  const sourceName = u.searchParams.get("source") || "自治体オープンデータ";
  const license = u.searchParams.get("license") || undefined;
  const prefecture = u.searchParams.get("pref") || undefined;

  try {
    const summary = await syncMunicipalFacilities({ url, sourceName, license, prefecture });
    return NextResponse.json({ ok: true, source: sourceName, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ ok: false, source: sourceName, error: message }, { status: 502 });
  }
}

export const POST = handle;
export const GET = handle;
