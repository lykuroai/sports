import { createServerClient } from "@spotomo/auth-client";
import { EVENT_STATUS_LABEL, formatDateTime, formatFee, VISIBLE_EVENT_STATUSES } from "@spotomo/shared-types";

// ランニング の仲間募集一覧。golf(apps/golf) を雛形に、固有機能は今後拡張。
export default async function Home() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .schema("running").from("events")
    .select("id, title, status, prefecture, city, event_start_at, participation_fee, capacity")
    .is("deleted_at", null)
    .in("status", VISIBLE_EVENT_STATUSES)
    .order("event_start_at", { ascending: true })
    .limit(30);

  type Row = {
    id: string; title: string; status: keyof typeof EVENT_STATUS_LABEL;
    prefecture: string | null; city: string | null; event_start_at: string;
    participation_fee: number; capacity: number;
  };
  const events = (data ?? []) as Row[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ランニング の仲間募集</h1>
      {events.length === 0 ? (
        <p className="text-slate-500">現在募集中の活動はありません。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="mb-1 flex gap-2">
                <span className="badge bg-brand/10 text-brand">ランニング</span>
                <span className="badge bg-slate-100 text-slate-600">{EVENT_STATUS_LABEL[r.status]}</span>
              </div>
              <h3 className="font-semibold">{r.title}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {formatDateTime(r.event_start_at)}・{r.prefecture ?? ""}{r.city ?? ""}・{formatFee(r.participation_fee)}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">
        募集作成・参加申請・チャット・ランニング 固有プロフィールは golf 雛形を複製して実装します。
      </p>
    </div>
  );
}
