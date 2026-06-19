import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, cookieOptions } from "./env";
import { loginUrl } from "./env";

export interface SessionOptions {
  /** ログイン必須のパス接頭辞。未ログインならログインへ誘導する。 */
  protectedPrefixes?: string[];
}

/**
 * リクエストごとに Supabase セッションを更新し、会員専用パスを保護する。
 * 各 app の proxy.ts から protectedPrefixes を渡して使う。
 * 未ログイン時は account サブドメインのログイン画面へ誘導する（共通認証）。
 */
export async function updateSession(
  request: NextRequest,
  options: SessionOptions = {},
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookieOptions: cookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
      ) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const prefixes = options.protectedPrefixes ?? [];
  if (!user && prefixes.some((p) => path.startsWith(p))) {
    const target = loginUrl(request.nextUrl.href);
    // ACCOUNT_URL 未設定（単一オリジン運用）なら自オリジンの /login に倒す
    if (target.startsWith("http")) return NextResponse.redirect(target);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  return response;
}
