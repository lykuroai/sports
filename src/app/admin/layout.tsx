import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/users", label: "利用者管理" },
  { href: "/admin/recruitments", label: "募集管理" },
  { href: "/admin/facilities/submissions", label: "施設登録申請" },
  { href: "/admin/facilities/import", label: "CSV取り込み" },
  { href: "/admin/reports", label: "通報管理" },
  { href: "/admin/sports", label: "カテゴリー管理" },
];

export const metadata = { title: "管理画面" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(); // 管理者以外はトップへリダイレクト

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="h-fit">
        <p className="mb-2 px-3 text-xs font-semibold uppercase text-slate-400">管理メニュー</p>
        <nav className="flex flex-col gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded px-3 py-2 hover:bg-slate-100">
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
