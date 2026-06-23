import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader, LegalLinks } from "@spotomo/shared-ui";
import { NotificationBell } from "@spotomo/shared-ui/notification-bell";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

export const metadata: Metadata = {
  title: { default: "施設運営者｜スポともパーク", template: "%s｜スポともパーク" },
  description: "スポーツ・レジャーを一緒に楽しむ仲間を募集・検索できるプラットフォーム。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const accountUrl = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "";
  return (
    <html lang="ja">
      <body className="min-h-screen">
        <SiteHeader appName="施設運営者" accountUrl={accountUrl} actions={<NotificationBell accountUrl={accountUrl} />} />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl space-y-3 px-4 py-8 text-sm text-slate-500">
            <LegalLinks baseUrl={SITE_URL} />
          </div>
        </footer>
      </body>
    </html>
  );
}
