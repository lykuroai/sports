/**
 * メール送信の薄いラッパー。
 * RESEND_API_KEY があれば Resend で送信、無ければログ出力のみ（開発時の no-op）。
 * 別プロバイダに差し替える場合はこの関数のみ変更する。
 */
export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "no-reply@example.com";

  if (!key) {
    console.log(`[email skipped] to=${to} subject=${subject}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) console.error("email send failed", res.status, await res.text());
  } catch (e) {
    // 通知のメール送信失敗で業務処理を止めない
    console.error("email send error", e);
  }
}
