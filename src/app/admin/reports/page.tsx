import { createClient } from "@/lib/supabase/server";
import { handleReport } from "../actions";
import { formatDateTime } from "@/lib/format";

const TARGET_LABEL: Record<string, string> = {
  recruitment: "募集",
  user: "利用者",
  message: "メッセージ",
  facility: "施設",
  review: "レビュー",
};

const ACTION_OPTIONS = [
  { value: "none", label: "対応不要（却下）" },
  { value: "warned", label: "警告" },
  { value: "hidden", label: "投稿を非公開" },
  { value: "recruitment_stopped", label: "募集を停止" },
  { value: "chat_restricted", label: "チャット制限" },
  { value: "suspended", label: "アカウント一時停止" },
  { value: "banned", label: "アカウント永久停止" },
];

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const open = (reports ?? []).filter((r) => ["open", "reviewing"].includes(r.status));
  const handled = (reports ?? []).filter((r) => !["open", "reviewing"].includes(r.status));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">通報管理</h1>

      <section>
        <h2 className="mb-3 font-semibold">未対応（{open.length}件）</h2>
        {open.length === 0 ? (
          <p className="card p-6 text-sm text-slate-500">未対応の通報はありません。</p>
        ) : (
          <ul className="space-y-3">
            {open.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="badge bg-slate-100 text-slate-600">{TARGET_LABEL[r.target_type] ?? r.target_type}</span>
                  <span className="text-sm font-medium">{r.reason}</span>
                  <span className="ml-auto text-xs text-slate-400">{formatDateTime(r.created_at)}</span>
                </div>
                {r.description && <p className="mb-3 text-sm text-slate-700">{r.description}</p>}
                <form action={handleReport} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="report_id" value={r.id} />
                  <select name="action_type" className="input max-w-xs" defaultValue="warned">
                    {ACTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button className="btn-primary">対応を確定</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">対応済み（{handled.length}件）</h2>
        {handled.length === 0 ? (
          <p className="card p-6 text-sm text-slate-500">対応済みの通報はありません。</p>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {handled.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="badge bg-slate-100 text-slate-600">{TARGET_LABEL[r.target_type] ?? r.target_type}</span>
                  <span className="ml-2">{r.reason}</span>
                </span>
                <span className="text-xs text-slate-400">
                  {r.status} / {r.action_type}・{formatDateTime(r.handled_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
