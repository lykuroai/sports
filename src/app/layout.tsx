import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: {
    default: "スポともパーク｜スポーツ・レジャー仲間募集",
    template: "%s｜スポともパーク",
  },
  description:
    "スポーツ・レジャーを一緒に楽しむ仲間を募集・検索できるプラットフォーム。地域・日時・種目から募集を探し、参加できます。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-500">
            <p>スポともパーク（MVP）— 仲間募集と参加を中心としたスポーツ・レジャープラットフォーム</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
