import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient, createServerClient, requestOrigin, resolvePostLogin, SCHEMA } from "@spotomo/auth-client";

export const runtime = "nodejs";

/** id_token(JWT) のペイロードを取り出す（署名検証は LINE のトークンエンドポイント経由で担保）。 */
function decodeIdToken(idToken: string): Record<string, unknown> {
  const payload = idToken.split(".")[1];
  const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json);
}

/**
 * LINE Login コールバック。code をトークンへ交換し、id_token から LINE ユーザを得て、
 * Supabase 側に find-or-create（admin）→ magiclink トークンで session を確立する。
 * （Supabase は LINE をネイティブ未対応のため、共通ユーザ基盤へブリッジする）
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = requestOrigin(request);
  const fail = (code: string) => NextResponse.redirect(`${base}/login?error=${code}`);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = (await cookies()).get("line_oauth_state")?.value;
  if (!code || !state || state !== cookieState) return fail("line_state");

  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelId || !channelSecret) return fail("line_unconfigured");

  // 1. code → token
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${base}/auth/line/callback`,
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });
  if (!tokenRes.ok) return fail("line_token");
  const token = (await tokenRes.json()) as { id_token?: string };
  if (!token.id_token) return fail("line_idtoken");

  // 2. id_token から LINE ユーザ情報
  const claims = decodeIdToken(token.id_token);
  const lineUserId = String(claims.sub ?? "");
  if (!lineUserId) return fail("line_sub");
  const name = (claims.name as string | undefined) ?? "LINEユーザー";
  // LINE がメールを返すのは「メールアドレス取得権限」が承認済み＋ユーザー同意時のみ。
  // 取得できなければ決定論的な合成メールで一意化する（後で実メール登録を促す）。
  const realEmail = (claims.email as string | undefined)?.trim() || undefined;
  const syntheticEmail = `line_${lineUserId}@line.spotomo.local`;
  const metadata = { nickname: name, line_user_id: lineUserId, provider: "line" };

  // 3. Supabase に find-or-create。実メールが取れた場合は、過去のメール無しログインで
  //    作られた合成メールアカウントを実メールへ移行する（同一 LINE ユーザーの一貫性）。
  const admin = createAdminClient();
  let email = realEmail ?? syntheticEmail;

  if (realEmail) {
    const { data: existing } = await admin
      .schema(SCHEMA.account)
      .from("users")
      .select("id")
      .eq("email", syntheticEmail)
      .maybeSingle();
    if (existing?.id) {
      // 既存の合成メールアカウントを実メールへ更新。実メールが他アカウントで使用中等で
      // 更新できない場合は合成のまま継続（既存アカウントとデータを保持）。
      const { error: migErr } = await admin.auth.admin.updateUserById((existing as { id: string }).id, {
        email: realEmail,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (migErr) {
        console.error("line email migrate error", migErr);
        email = syntheticEmail;
      }
    } else {
      // 実メールのアカウントを find-or-create（既存なら 422 を無視＝メールでのアカウント統合）。
      await admin.auth.admin.createUser({ email: realEmail, email_confirm: true, user_metadata: metadata });
    }
  } else {
    await admin.auth.admin.createUser({ email: syntheticEmail, email_confirm: true, user_metadata: metadata });
  }

  // 4. magiclink トークンを生成し、session を確立（メール送信はせずトークンを直接検証）
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) return fail("line_link");

  const supabase = await createServerClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verifyErr) return fail("line_session");

  // 元ページ（line_next Cookie）へ戻す。外部URLは /profile にフォールバック。
  const nextCookie = (await cookies()).get("line_next")?.value;
  const next = resolvePostLogin(nextCookie);
  const dest = next.startsWith("http") ? next : `${base}${next}`;
  const res = NextResponse.redirect(dest);
  res.cookies.set("line_oauth_state", "", { maxAge: 0, path: "/" });
  res.cookies.set("line_next", "", { maxAge: 0, path: "/" });
  return res;
}
