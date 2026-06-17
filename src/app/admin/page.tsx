import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function count(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply: (q: any) => any = (q) => q,
): Promise<number> {
  const { count: c } = await apply(
    supabase.from(table).select("*", { count: "exact", head: true }),
  );
  return c ?? 0;
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [users, recruitments, facilities, openReports, pendingSubs] = await Promise.all([
    count(supabase, "users"),
    count(supabase, "recruitments", (q) => q.is("deleted_at", null)),
    count(supabase, "facilities", (q) => q.is("deleted_at", null)),
    count(supabase, "reports", (q) => q.in("status", ["open", "reviewing"])),
    count(supabase, "facility_submissions", (q) => q.eq("status", "pending")),
  ]);

  const cards = [
    { label: "登録利用者", value: users, href: "/admin/users" },
    { label: "公開募集", value: recruitments, href: "/admin/recruitments" },
    { label: "登録施設", value: facilities, href: "/admin/facilities/submissions" },
    { label: "未対応の通報", value: openReports, href: "/admin/reports", alert: openReports > 0 },
    { label: "施設申請（承認待ち）", value: pendingSubs, href: "/admin/facilities/submissions", alert: pendingSubs > 0 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">ダッシュボード</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`card p-5 transition-shadow hover:shadow-md ${c.alert ? "border-amber-300 bg-amber-50" : ""}`}
          >
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-1 text-3xl font-bold">{c.value.toLocaleString()}</p>
          </Link>
        ))}
      </div>
      <p className="text-sm text-slate-500">
        各メニューから利用者・募集・通報・施設申請・カテゴリーを管理できます。
        重要操作は監査ログ（audit_logs）に記録されます。
      </p>
    </div>
  );
}
