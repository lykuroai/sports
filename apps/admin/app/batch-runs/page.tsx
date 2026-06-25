import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";

export const metadata = { title: "取り込みバッチ履歴" };

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  success: { text: "成功", cls: "bg-emerald-100 text-emerald-800" },
  running: { text: "実行中", cls: "bg-sky-100 text-sky-800" },
  partial: { text: "一部失敗", cls: "bg-amber-100 text-amber-800" },
  failed: { text: "失敗", cls: "bg-rose-100 text-rose-800" },
};

// 外部データ取得バッチ（core.batch_runs）の実行履歴。再実行UIは未対応（cron 経由）。
export default async function BatchRunsPage() {
  await requireAdmin();
  const supabase = await createServerClient();

  const { data } = await supabase
    .schema(SCHEMA.core)
    .from("batch_runs")
    .select("id, job_name, status, started_at, finished_at, total_count, success_count, failed_count, error_message")
    .order("started_at", { ascending: false })
    .limit(50);

  type Row = {
    id: string; job_name: string; status: string;
    started_at: string | null; finished_at: string | null;
    total_count: number; success_count: number; failed_count: number;
    error_message: string | null;
  };
  const runs = (data ?? []) as Row[];

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("ja-JP") : "—");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">取り込みバッチ履歴</h1>
        <a href="/facilities" className="text-sm text-brand hover:underline">取り込み施設の承認 →</a>
      </div>

      {runs.length === 0 ? (
        <p className="text-slate-500">バッチ実行履歴はありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">ジョブ</th>
                <th className="py-2 pr-4">状態</th>
                <th className="py-2 pr-4">開始</th>
                <th className="py-2 pr-4">完了</th>
                <th className="py-2 pr-4 text-right">対象 / 成功 / 失敗</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const st = STATUS_LABEL[r.status] ?? { text: r.status, cls: "bg-slate-100 text-slate-700" };
                return (
                  <tr key={r.id} className="border-b align-top">
                    <td className="py-2 pr-4 font-medium">{r.job_name}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded px-2 py-0.5 text-xs ${st.cls}`}>{st.text}</span>
                      {r.error_message && <div className="mt-1 max-w-xs text-xs text-rose-600">{r.error_message}</div>}
                    </td>
                    <td className="py-2 pr-4 text-slate-500">{fmt(r.started_at)}</td>
                    <td className="py-2 pr-4 text-slate-500">{fmt(r.finished_at)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.total_count} / {r.success_count} / {r.failed_count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
