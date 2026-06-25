import type { Metadata } from "next";
import Link from "next/link";
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
        <SiteHeader
          appName=""
          accountUrl={accountUrl}
          currentOrigin={currentOrigin}
          accountLabel="プロフィール"
          myPageHref="/mypage"
          loggedIn={!!user}
          loginHref={loginHref}
          nav={
            <>
              <Link href="/running" className="hover:text-brand">ランニング</Link>
              <Link href="/events" className="hover:text-brand">大会を探す</Link>
              <Link href="/facilities" className="hover:text-brand">施設を探す</Link>
              <Link href="/recruitments/new" className="hover:text-brand">募集を作成</Link>
            </>
          }
          actions={<NotificationBell accountUrl={accountUrl} />}
        />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white">
          {/* グループ化フッター（top_page_design §17）。探す / 登録 / 運営。法務は下段の LegalLinks。 */}
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 py-8 text-sm sm:grid-cols-3">
            <div>
              <div className="mb-2 font-semibold text-slate-700">探す</div>
              <ul className="space-y-1 text-slate-500">
                <li><Link href="/running" className="hover:text-brand">仲間募集</Link></li>
                <li><Link href="/facilities" className="hover:text-brand">施設</Link></li>
                <li><Link href="/events" className="hover:text-brand">イベント・大会</Link></li>
              </ul>
            </div>
            <div>
              <div className="mb-2 font-semibold text-slate-700">登録</div>
              <ul className="space-y-1 text-slate-500">
                <li><Link href="/recruitments/new" className="hover:text-brand">仲間を募集する</Link></li>
                <li><Link href="/facilities" className="hover:text-brand">施設を探す・登録</Link></li>
              </ul>
            </div>
            <div>
              <div className="mb-2 font-semibold text-slate-700">運営</div>
              <ul className="space-y-1 text-slate-500">
                <li><a href="mailto:support@lykuro.ai" className="hover:text-brand">お問い合わせ</a></li>
                <li><Link href="/legal" className="hover:text-brand">会社情報</Link></li>
              </ul>
            </div>
          </div>
          <div className="mx-auto flex max-w-5xl flex-col gap-3 border-t border-slate-100 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">© 2026 株式会社eビジネスソリューション</span>
            <LegalLinks />
          </div>
        </footer>
      </body>
    </html>
  );
}
