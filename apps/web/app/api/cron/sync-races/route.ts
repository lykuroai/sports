import { NextResponse } from "next/server";
import { fetchFeed, syncRaces } from "@/lib/race-sync";

export const runtime = "nodejs";
// 取得→照合→upsert に時間がかかり得るため動的・キャッシュ無効。
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 定期バッチ: 公式API/許諾フィードから「開催日が未来日」のマラソン大会を取得し、
// running.races と (source, source_id) で照合して新規追加/既存更新する。
// cron（システム cron / Supabase pg_cron 等）から CRON_SECRET 付きで叩く想定。
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET 未設定" }, { status: 500 });

  const auth = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  const ok = auth === `Bearer ${secret}` || headerSecret === secret;
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const feed = await fetchFeed();
    const summary = await syncRaces(feed);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

export const POST = handle;
// cron サービスによっては GET しか叩けないため両対応。
export const GET = handle;
