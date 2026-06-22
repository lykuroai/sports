import type { ReactNode } from "react";
import { SPORT_DOMAINS } from "@spotomo/shared-types";
import { selfOrigin } from "@spotomo/auth-client";

export interface SiteHeaderProps {
  /** 現在の app の表示名（例: "ゴルフ" / "共通アカウント"）。 */
  appName: string;
  /** account サブドメインのベース URL。 */
  accountUrl?: string;
  /** 右側に差し込む追加要素（ログイン状態など）。 */
  actions?: ReactNode;
}

/**
 * 全 app 共有のヘッダ。種目スイッチャと共通アカウントへの導線を持つ。
 * 種目間の遷移はサブドメイン跨ぎ（本番）。開発時は host が無ければ相対リンクに倒す。
 */
export async function SiteHeader({ appName, accountUrl = "", actions }: SiteHeaderProps) {
  // 種目アプリから「アカウント」へ移動して共通プロフィールを編集した後、元の種目アプリへ
  // 戻れるよう redirect（自オリジンの絶対URL）を付ける。account 側の resolvePostLogin が
  // 同一 apex のみ許可して検証する。account アプリ自身（同一オリジン）では付けない。
  const origin = await selfOrigin();
  let accountHref = `${accountUrl}/profile`;
  try {
    const sameHost =
      !accountUrl || new URL(accountUrl).host === new URL(origin).host;
    if (!sameHost) {
      accountHref = `${accountUrl}/profile?redirect=${encodeURIComponent(origin)}`;
    }
  } catch {
    // URL 解析不能時は redirect なし（フォールバック）
  }

  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-4">
        <a href="/" className="font-bold text-brand">
          スポともパーク
        </a>
        <span className="text-sm text-gray-500">{appName}</span>
      </div>

      <nav className="flex items-center gap-3 text-sm">
        {SPORT_DOMAINS.map((d) => (
          <a key={d.slug} href={`//${d.host}`} className="hover:text-brand">
            {d.name}
          </a>
        ))}
        <a href={accountHref} className="hover:text-brand">
          アカウント
        </a>
        {actions}
      </nav>
    </header>
  );
}
