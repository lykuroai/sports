/**
 * Twilio Verify の薄いラッパー（REST + Basic 認証）。**サーバー専用**。
 * 携帯番号認証（OTP）の送信・検証に使う。SDK は使わず fetch のみ。
 * TWILIO_* が未設定なら例外（OTP は本番必須機能のため no-op にはしない）。
 */
function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) {
    throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SERVICE_SID が設定されていません");
  }
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  return { serviceSid, auth };
}

async function twilioPost(path: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const { serviceSid, auth } = twilioConfig();
  const res = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof data.message === "string" ? data.message : `Twilio error ${res.status}`;
    throw new Error(message);
  }
  return data;
}

/** OTP を SMS で送信する。E.164 形式の電話番号を渡すこと。 */
export async function sendVerification(phone: string): Promise<void> {
  await twilioPost("Verifications", { To: phone, Channel: "sms" });
}

/** OTP を検証する。承認されれば true。 */
export async function checkVerification(phone: string, code: string): Promise<boolean> {
  try {
    const data = await twilioPost("VerificationCheck", { To: phone, Code: code });
    return data.status === "approved";
  } catch {
    // 期限切れ・コード不一致は VerificationCheck が 404 を返すことがある → 検証失敗として扱う
    return false;
  }
}
