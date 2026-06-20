/**
 * Cloudflare Turnstile のサーバー側検証（siteverify）。**サーバー専用**。
 * ログイン/サインアップ/電話OTP送信など、認証系 Server Action の冒頭で呼び、
 * クライアントのウィジェットが発行したトークンを検証してからボットを弾く。
 *
 * TURNSTILE_SECRET_KEY 未設定なら検証をスキップ（true を返す）。鍵が無い開発環境で
 * 認証フローを止めないため。本番では必ず鍵を設定すること（未設定だと無防備になる）。
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("TURNSTILE_SECRET_KEY 未設定: CAPTCHA 検証をスキップします（開発用）");
    return true;
  }
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("turnstile siteverify error", e);
    return false;
  }
}
