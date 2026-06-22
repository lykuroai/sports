import type { ReactNode } from "react";
import { SPORT_DOMAINS } from "@spotomo/shared-types";

export interface SiteHeaderProps {
  /** 現在の app の表示名（例: "ゴルフ" / "共通アカウント"）。空文字なら表示しない。 */
  appName: string;
  /** ロゴのブランド表記（既定: "スポともパーク"）。種目アプリは自前の名称を渡せる。 */
  brand?: string;
  /**
   * 中央ナビを差し替える。未指定なら全種目スイッチャを表示する。種目アプリで
   * その種目向けの導線（例: ゴルフ場を探す / 募集を作成）に置き換える用途。
   */
  nav?: ReactNode;
  /** account サブドメインのベース URL。 */
  accountUrl?: string;
  /**
   * このアプリの公開オリジン（例: https://golf-spotomo.lykuro.ai）。指定があり、かつ
   * accountUrl と別オリジンなら「アカウント」リンクに redirect を付け、共通プロフィール
   * 編集後に元の種目アプリへ戻す。サーバー（layout）で selfOrigin() から渡す。
   */
  currentOrigin?: string;
  /** 右側に差し込む追加要素（ログイン状態など）。 */
  actions?: ReactNode;
}

/**
 * 全 app 共有のヘッダ。種目スイッチャと共通アカウントへの導線を持つ。
 * 種目間の遷移はサブドメイン跨ぎ（本番）。開発時は host が無ければ相対リンクに倒す。
 */
export function SiteHeader({
  appName,
  brand = "スポともパーク",
  nav,
  accountUrl = "",
  currentOrigin = "",
  actions,
}: SiteHeaderProps) {
  // 種目アプリから「アカウント」へ移動して共通プロフィールを編集した後、元の種目アプリへ
  // 戻れるよう redirect（自オリジンの絶対URL）を付ける。account 側の resolvePostLogin が
  // 同一 apex のみ許可して検証する。account アプリ自身（同一オリジン）では付けない。
  let accountHref = `${accountUrl}/profile`;
  try {
    const sameHost =
      !currentOrigin || !accountUrl || new URL(accountUrl).host === new URL(currentOrigin).host;
    if (!sameHost) {
      accountHref = `${accountUrl}/profile?redirect=${encodeURIComponent(currentOrigin)}`;
    }
  } catch {
    // URL 解析不能時は redirect なし（フォールバック）
  }

  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-4">
        <a href="/" className="font-bold text-brand">
          {brand}
        </a>
        {appName && <span className="text-sm text-gray-500">{appName}</span>}
      </div>

      <nav className="flex items-center gap-3 text-sm">
        {nav ??
          SPORT_DOMAINS.map((d) => (
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
