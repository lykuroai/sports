import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@spotomo/shared-ui";
import { NotificationBell } from "@spotomo/shared-ui/notification-bell";

export const metadata: Metadata = {
  title: { default: "運営管理｜スポともパーク", template: "%s｜スポともパーク" },
  description: "スポーツ・レジャーを一緒に楽しむ仲間を募集・検索できるプラットフォーム。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const accountUrl = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "";
  return (
    <html lang="ja">
      <body className="min-h-screen">
        <SiteHeader appName="運営管理" accountUrl={accountUrl} actions={<NotificationBell accountUrl={accountUrl} />} />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-500">
            <p>スポともパーク — 共通ユーザ基盤 + 種目別ドメイン構成</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
