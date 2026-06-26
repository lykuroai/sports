import { type NextRequest } from "next/server";
import { updateSession } from "@spotomo/auth-client/middleware";

// 一般会員の保護パス（未ログインは同一オリジンの /login へ。ACCOUNT_URL 未設定＝単一オリジン）。
const GENERAL_PREFIXES = [
  "/mypage",
  "/recruitments/new",
  "/profile",
  "/chat",
  "/billing",
  "/settings",
  "/notifications",
  "/withdraw",
  "/verification",
  "/facilities/register",
];
// 施設運営者の専用領域（未ログインは運営者ログイン /owner/login へ誘導）。
const OWNER_PREFIXES = ["/owner", "/facilities/submit"];
// 運営者の認証ページ自体は保護しない（自己リダイレクトのループ防止）。
const OWNER_AUTH_PAGES = ["/owner/login", "/owner/register"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (OWNER_PREFIXES.some((p) => path.startsWith(p))) {
    // 運営者ログイン/登録ページはセッション更新のみ（保護対象外）。
    if (OWNER_AUTH_PAGES.some((p) => path.startsWith(p))) {
      return await updateSession(request);
    }
    return await updateSession(request, {
      protectedPrefixes: OWNER_PREFIXES,
      loginPath: "/owner/login",
    });
  }

  return await updateSession(request, { protectedPrefixes: GENERAL_PREFIXES });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
