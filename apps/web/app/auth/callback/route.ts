import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, requestOrigin, resolvePostLogin } from "@spotomo/auth-client";

// OAuth（Google）/ メール確認のコールバック。code を session に交換する。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // リバースプロキシ越しだと request.url の origin が内部アドレス（0.0.0.0:3000）に
  // なるため、X-Forwarded-Host から公開オリジンを組み立てて戻り先にする（単一オリジン）。
  const base = requestOrigin(request);
  const code = searchParams.get("code");
  // メール確認（サインアップ）からの遷移。認証完了後は自動ログインせず
  // ログイン画面へ誘導する（OAuth 等は従来どおり next へ）。
  const verify = searchParams.get("verify");

  // 戻り先(next)の取得元: メール確認はリンクの query(next)、OAuth(Google) は
  // oauth_next Cookie を優先する。Supabase OAuth は redirectTo のクエリを許可リスト
  // 次第で落とすため、Cookie で持ち回す（無ければ query にフォールバック）。
  const cookieStore = await cookies();
  const rawNext =
    verify === "email"
      ? searchParams.get("next")
      : cookieStore.get("oauth_next")?.value ?? searchParams.get("next");
  // 元ページ（next）を安全に解決。外部URLは /profile にフォールバック。
  const next = resolvePostLogin(rawNext);
  const dest = next.startsWith("http") ? next : `${base}${next}`;

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (verify === "email") {
        await supabase.auth.signOut();
        // 認証後の戻り先（プロフィール設定→元ページ）をログイン画面へ引き継ぐ。
        // 施設運営者（next が /owner 配下）は運営者ログインへ、一般は通常ログインへ。
        const loginPath = next.startsWith("/owner") ? "/owner/login" : "/login";
        const q = next && next !== "/profile" ? `&redirect=${encodeURIComponent(next)}` : "";
        return NextResponse.redirect(`${base}${loginPath}?notice=verified${q}`);
      }
      const res = NextResponse.redirect(dest);
      res.cookies.set("oauth_next", "", { maxAge: 0, path: "/" });
      return res;
    }
  }
  return NextResponse.redirect(`${base}/login?error=auth`);
}
