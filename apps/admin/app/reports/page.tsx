import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";
import { resolveReport } from "../actions";

export default async function ReportsPage() {
  await requireAdmin();
  const supabase = await createServerClient();
  const { data } = await supabase
    .schema(SCHEMA.core).from("reports")
    .select("id, domain, target_type, reason, status, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false }).limit(100);

  type Row = { id: string; domain: string; target_type: string; reason: string; status: string };
  const reports = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">通報対応</h1>
      {reports.length === 0 ? (
        <p className="text-slate-500">未対応の通報はありません。</p>
      ) : reports.map((r) => (
        <div key={r.id} className="card flex items-center justify-between p-4 text-sm">
          <div>
            <span className="badge bg-slate-100 text-slate-600">{r.domain}/{r.target_type}</span>
            <p className="mt-1">{r.reason}</p>
          </div>
          <form action={resolveReport} className="flex gap-2">
            <input type="hidden" name="report_id" value={r.id} />
            <select name="action" className="input max-w-[10rem]">
              <option value="warned">警告</option>
              <option value="hidden">非表示</option>
              <option value="suspended">利用停止</option>
              <option value="none">対応不要</option>
            </select>
            <button className="btn-primary" type="submit">対応</button>
          </form>
        </div>
      ))}
    </div>
  );
}
