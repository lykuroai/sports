import { NextResponse } from "next/server";
import { ACCOUNT_URL, createServerClient, resolvePostLogin } from "@spotomo/auth-client";

// OAuth（Google）/ メール確認のコールバック。code を session に交換する。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // リバースプロキシ越しだと origin が内部アドレス（0.0.0.0:3000）になるため、
  // 公開 URL（NEXT_PUBLIC_ACCOUNT_URL）を優先して戻り先を組み立てる。
  const base = ACCOUNT_URL() || origin;
  const code = searchParams.get("code");
  // 元ページ（next）を安全に解決。外部URLは /profile にフォールバック。
  const next = resolvePostLogin(searchParams.get("next"));
  const dest = next.startsWith("http") ? next : `${base}${next}`;
  // メール確認（サインアップ）からの遷移。認証完了後は自動ログインせず
  // ログイン画面へ誘導する（OAuth 等は従来どおり next へ）。
  const verify = searchParams.get("verify");

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (verify === "email") {
        await supabase.auth.signOut();
        // 認証後の戻り先（プロフィール設定→元ページ）をログイン画面へ引き継ぐ。
        const q = next && next !== "/profile" ? `&redirect=${encodeURIComponent(next)}` : "";
        return NextResponse.redirect(`${base}/login?notice=verified${q}`);
      }
      return NextResponse.redirect(dest);
    }
  }
  return NextResponse.redirect(`${base}/login?error=auth`);
}
