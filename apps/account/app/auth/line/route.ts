import { NextResponse } from "next/server";
import { ACCOUNT_URL } from "@spotomo/auth-client";

export const runtime = "nodejs";

// LINE Login（v2.1 / OIDC）への認可リクエスト。Supabase はネイティブ未対応のため自前実装。
export async function GET(request: Request) {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.redirect(`${ACCOUNT_URL() || new URL(request.url).origin}/login?error=line_unconfigured`);
  }
  const base = ACCOUNT_URL() || new URL(request.url).origin;
  const redirectUri = `${base}/auth/line/callback`;
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();

  const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", channelId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "openid profile email");
  authUrl.searchParams.set("nonce", nonce);

  const res = NextResponse.redirect(authUrl.toString());
  // CSRF 対策に state を HttpOnly Cookie で保持し、callback で照合
  res.cookies.set("line_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
