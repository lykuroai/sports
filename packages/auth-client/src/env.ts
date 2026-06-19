/** 環境変数の集約。account サブドメインの URL は種目 app からのログイン誘導に使う。 */
export const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** 共通ユーザ管理（account）のベース URL。未設定時は同一オリジンの /account 配下を使う。 */
export const ACCOUNT_URL = () => process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "";

/**
 * サブドメイン間でセッション Cookie を共有するためのドメイン（本番: ".spotomo-park.jp"）。
 * 未設定（ローカル開発の単一オリジン）なら host-only Cookie のまま。
 */
export const COOKIE_DOMAIN = () => process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

/** @supabase/ssr に渡す cookieOptions。ドメイン未設定なら undefined。 */
export function cookieOptions(): { domain: string } | undefined {
  const domain = COOKIE_DOMAIN();
  return domain ? { domain } : undefined;
}

export function loginUrl(redirectTo?: string): string {
  const base = ACCOUNT_URL();
  const path = "/login";
  const qs = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : "";
  return `${base}${path}${qs}`;
}
