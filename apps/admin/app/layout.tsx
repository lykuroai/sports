import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@spotomo/shared-ui";

export const metadata: Metadata = {
  title: { default: "運営管理｜スポともパーク", template: "%s｜スポともパーク" },
  description: "スポーツ・レジャーを一緒に楽しむ仲間を募集・検索できるプラットフォーム。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen">
        {/* 管理画面は利用者向け導線（種目スイッチャ／アカウント／通知）不要のため minimal。 */}
        <SiteHeader appName="運営管理" minimal />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
