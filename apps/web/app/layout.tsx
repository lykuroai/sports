import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader, LegalLinks } from "@spotomo/shared-ui";
import { NotificationBell } from "@spotomo/shared-ui/notification-bell";
import { selfOrigin, getUser, loginUrlFor } from "@spotomo/auth-client";

export const metadata: Metadata = {
  title: { default: "スポともパーク｜スポともパーク", template: "%s｜スポともパーク" },
  description: "スポーツ・レジャーを一緒に楽しむ仲間を募集・検索できるプラットフォーム。",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const accountUrl = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "";
  const currentOrigin = await selfOrigin();
  const user = await getUser();
  const loginHref = await loginUrlFor("/");
  return (
    <html lang="ja">
      <body className="min-h-screen">
        <SiteHeader appName="" accountUrl={accountUrl} currentOrigin={currentOrigin} accountLabel="プロフィール" loggedIn={!!user} loginHref={loginHref} actions={<NotificationBell accountUrl={accountUrl} />} />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl space-y-3 px-4 py-8 text-sm text-slate-500">
            <LegalLinks />
          </div>
        </footer>
      </body>
    </html>
  );
}
