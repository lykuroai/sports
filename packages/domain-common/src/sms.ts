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

export interface PhoneLookupResult {
  /** 番号が実在・有効か。 */
  valid: boolean;
  /** 回線種別（'mobile'|'landline'|'voip'…）。Line Type Intelligence 未契約なら null。 */
  lineType: string | null;
}

/**
 * Twilio Lookup v2 で電話番号の実在・有効性を確認する。**サーバー専用**。
 * OTP（SMS）を送る前に呼び、存在しない/無効な番号への送信と課金・トールフラウドを防ぐ。
 * 404（不存在）は valid:false を返す。認証情報未設定や障害時は例外（呼び出し側で握る）。
 */
export async function lookupPhone(phone: string): Promise<PhoneLookupResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN が設定されていません");
  }
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  // 不存在/フォーマット不正は 404。存在チェックとして valid:false 扱い。
  if (res.status === 404) return { valid: false, lineType: null };
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof data.message === "string" ? data.message : `Twilio Lookup error ${res.status}`;
    throw new Error(message);
  }
  const lti = data.line_type_intelligence as { type?: string } | null | undefined;
  return { valid: data.valid === true, lineType: lti?.type ?? null };
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
