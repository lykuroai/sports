/** 環境変数の集約。account サブドメインの URL は種目 app からのログイン誘導に使う。 */
export const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** 共通ユーザ管理（account）のベース URL。未設定時は同一オリジンの /account 配下を使う。 */
export const ACCOUNT_URL = () => process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "";

/**
 * サブドメイン間でセッション Cookie を共有するためのドメイン（本番: ".lykuro.ai"）。
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

/**
 * Route Handler のリクエストから公開オリジンを組み立てる。リバースプロキシ（Caddy）越しでは
 * request.url の origin が内部アドレス（0.0.0.0:3000）になるため、X-Forwarded-Host/Proto を
 * 優先する。単一オリジン運用（ACCOUNT_URL 未設定）で OAuth/メール確認のコールバックを
 * 自オリジンへ正しく戻すために使う。
 */
export function requestOrigin(request: Request): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

/** apex（登録ドメイン）を粗く取り出す（例: golf-spotomo.lykuro.ai → lykuro.ai）。 */
function apex(host: string): string {
  return host.split(".").slice(-2).join(".");
}

/**
 * ログイン後の遷移先を安全に解決する。元ページ（相対パス or 自サービス内の絶対URL）は
 * 許可し、外部URL（オープンリダイレクト）は /profile にフォールバックする。
 * 戻り値は相対パス（"/..."）または検証済み絶対URL。
 */
export function resolvePostLogin(next?: string | null): string {
  const fallback = "/profile";
  if (!next) return fallback;
  // 相対パスのみ許可（"//evil.com" のようなスキーム相対は弾く）。
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  try {
    const u = new URL(next);
    const acc = new URL(ACCOUNT_URL() || "http://localhost");
    if (u.hostname === acc.hostname || apex(u.hostname) === apex(acc.hostname)) {
      return u.toString();
    }
  } catch {
    // 解析不能はフォールバック
  }
  return fallback;
}
