import type { ReactNode } from "react";
import { SPORT_DOMAINS } from "@spotomo/shared-types";

export interface SiteHeaderProps {
  /** 現在の app の表示名（例: "ゴルフ" / "共通アカウント"）。空文字なら表示しない。 */
  appName: string;
  /** ロゴのブランド表記（既定: "スポともパーク"）。種目アプリは自前の名称を渡せる。 */
  brand?: string;
  /**
   * ブランド名の前に表示するロゴ要素（例: 種目ロゴの <img>）。指定があればブランド表記の
   * 左に並べる。種目アプリで自前のロゴ画像を渡す用途。
   */
  logo?: ReactNode;
  /**
   * 中央ナビを差し替える。未指定なら全種目スイッチャを表示する。種目アプリで
   * その種目向けの導線（例: ゴルフ場を探す / 募集を作成）に置き換える用途。
   */
  nav?: ReactNode;
  /** account サブドメインのベース URL。 */
  accountUrl?: string;
  /**
   * 「マイページ」リンクの遷移先。指定された種目アプリのみヘッダに表示する
   * （account アプリには /mypage が無いため未指定で非表示）。
   */
  myPageHref?: string;
  /**
   * ログイン状態。`false` かつ `loginHref` 指定時は「アカウント／マイページ」の代わりに
   * 「ログイン（新規登録）」を表示する。未指定（undefined）なら従来どおりアカウントを表示。
   */
  loggedIn?: boolean;
  /** 未ログイン時の「ログイン（新規登録）」リンク先（account 共通ログインの絶対URL）。 */
  loginHref?: string;
  /**
   * このアプリの公開オリジン（例: https://golf-spotomo.lykuro.ai）。指定があり、かつ
   * accountUrl と別オリジンなら「アカウント」リンクに redirect を付け、共通プロフィール
   * 編集後に元の種目アプリへ戻す。サーバー（layout）で selfOrigin() から渡す。
   */
  currentOrigin?: string;
  /** 右側に差し込む追加要素（ログイン状態など）。 */
  actions?: ReactNode;
  /**
   * ログイン済みで myPageHref を渡さないアプリの、アカウント導線のラベル（既定: "アカウント"）。
   * 総合ポータルのように共通プロフィールへ直接飛ばす場合は "プロフィール" 等に差し替える。
   */
  accountLabel?: string;
  /**
   * 総合ポータル（スポともパーク）の URL。指定があればナビ先頭に「スポともパーク」への
   * 戻り導線を表示する。総合アプリ自身では指定しない。
   */
  portalUrl?: string;
}

/**
 * 全 app 共有のヘッダ。種目スイッチャと共通アカウントへの導線を持つ。
 * 種目間の遷移はサブドメイン跨ぎ（本番）。開発時は host が無ければ相対リンクに倒す。
 */
export function SiteHeader({
  appName,
  brand = "スポともパーク",
  logo,
  nav,
  accountUrl = "",
  currentOrigin = "",
  myPageHref,
  loggedIn,
  loginHref,
  actions,
  accountLabel = "アカウント",
  portalUrl,
}: SiteHeaderProps) {
  // 未ログイン（loggedIn === false）かつログイン先がある場合は、アカウント／マイページの
  // 代わりに「ログイン（新規登録）」を表示する。
  const showLogin = loggedIn === false && !!loginHref;
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
        <a href="/" className="flex items-center gap-2 font-bold text-brand">
          {logo}
          {brand}
        </a>
        {appName && <span className="text-sm text-gray-500">{appName}</span>}
      </div>

      <nav className="flex items-center gap-3 text-sm">
        {portalUrl && (
          <a href={portalUrl} className="font-medium text-brand hover:underline">
            ← スポともパーク
          </a>
        )}
        {nav ??
          SPORT_DOMAINS.map((d) => (
            <a key={d.slug} href={`//${d.host}`} className="hover:text-brand">
              {d.name}
            </a>
          ))}
        {showLogin ? (
          <a href={loginHref} className="hover:text-brand">
            ログイン
          </a>
        ) : myPageHref ? (
          // ログイン済み（種目アプリ）。プロフィールはマイページ画面側に置くため、
          // ヘッダは「マイページ」単独リンク（アカウント表記は廃止）。
          <>
            <a href={myPageHref} className="hover:text-brand">
              マイページ
            </a>
            {actions}
          </>
        ) : (
          // myPageHref を渡さないアプリ（account 等）は従来どおり「アカウント」を表示。
          <>
            <a href={accountHref} className="hover:text-brand">
              {accountLabel}
            </a>
            {actions}
          </>
        )}
      </nav>
    </header>
  );
}
