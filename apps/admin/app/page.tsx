import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";

// 管理画面は requireAdmin() でガード（多要素認証は仕様 §11.1、今後対応）。
// 読み取りは管理者 RLS が通るセッションクライアント、書き込みはサービスロール。
export default async function AdminDashboard() {
  await requireAdmin();
  const supabase = await createServerClient();

  const [users, reports, submissions, owners] = await Promise.all([
    supabase.schema(SCHEMA.account).from("users").select("id", { count: "exact", head: true }),
    supabase.schema(SCHEMA.core).from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.schema(SCHEMA.facility).from("facility_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.schema(SCHEMA.facility).from("facility_owners").select("facility_id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const cards = [
    { label: "登録ユーザ", value: users.count ?? 0, href: "/users" },
    { label: "未対応の通報", value: reports.count ?? 0, href: "/reports" },
    { label: "施設申請（保留）", value: submissions.count ?? 0, href: "/facility-submissions" },
    { label: "運営者申請（保留）", value: owners.count ?? 0, href: "/facility-owners" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">運営管理ダッシュボード</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <a key={c.label} href={c.href} className="card p-5 hover:shadow">
            <div className="text-sm text-slate-500">{c.label}</div>
            <div className="mt-1 text-3xl font-bold text-brand-dark">{c.value}</div>
          </a>
        ))}
      </div>
      <nav className="card flex flex-wrap gap-4 p-4 text-sm">
        <a className="text-brand hover:underline" href="/users">利用者管理</a>
        <a className="text-brand hover:underline" href="/reports">通報対応</a>
        <a className="text-brand hover:underline" href="/facility-submissions">施設登録申請</a>
        <a className="text-brand hover:underline" href="/facility-owners">施設運営者申請</a>
        <a className="text-brand hover:underline" href="/sports">カテゴリ管理</a>
        <a className="text-brand hover:underline" href="/facilities/import">施設CSV取り込み</a>
      </nav>

      <p className="text-xs text-slate-400">
        管理操作（停止・通報対応・施設申請承認）はサービスロールで実行し、core.audit_logs に記録します。
        全スキーマ横断（account / core / facility / golf / running / outdoor）。
      </p>
    </div>
  );
}
