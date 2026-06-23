"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient, createAdminClient, resolvePostLogin, SCHEMA } from "@spotomo/auth-client";
import { sendVerification, checkVerification, verifyTurnstile, lookupPhone, type PhoneLookupResult } from "@spotomo/domain-common";

export type PhoneState = { step: "request" | "verify"; phone: string; error: string | null };

const phoneSchema = z.string().min(8, "電話番号を入力してください").max(20);

/** 日本の 0始まり番号を E.164（+81…）へ。+ 始まりはそのまま。 */
function toE164(raw: string): string {
  const t = raw.replace(/[\s-]/g, "");
  if (t.startsWith("+")) return t;
  if (t.startsWith("0")) return "+81" + t.slice(1);
  return "+" + t;
}

export async function requestOtp(_prev: PhoneState, formData: FormData): Promise<PhoneState> {
  const parsed = phoneSchema.safeParse(formData.get("phone"));
  if (!parsed.success) return { step: "request", phone: "", error: parsed.error.errors[0].message };

  // SMS は Twilio 課金が発生するため、送信前に CAPTCHA を検証してボット/トールフラウドを弾く。
  const captcha = await verifyTurnstile(formData.get("cf-turnstile-response") as string | null);
  if (!captcha) {
    return { step: "request", phone: "", error: "認証（CAPTCHA）に失敗しました。もう一度お試しください。" };
  }

  const phone = toE164(parsed.data);

  // SMS を送る前に番号の実在・有効性をチェック（不存在/無効な番号への送信と課金を防ぐ）。
  const invalid = await checkPhoneExists(phone);
  if (invalid) return { step: "request", phone: "", error: invalid };

  try {
    await sendVerification(phone);
  } catch (e) {
    console.error("twilio verify send error", e);
    return { step: "request", phone, error: "認証コードの送信に失敗しました。時間をおいて再度お試しください。" };
  }

  return { step: "verify", phone, error: null };
}

/**
 * 番号の実在チェック（Twilio Lookup）。問題があればエラーメッセージを、なければ null。
 * Lookup 自体の失敗（認証情報未設定・障害）はフェイルオープン（null）で OTP 送信を妨げない。
 */
async function checkPhoneExists(phone: string): Promise<string | null> {
  let lookup: PhoneLookupResult | null = null;
  try {
    lookup = await lookupPhone(phone);
  } catch (e) {
    console.error("twilio lookup error", e);
    return null;
  }
  if (!lookup.valid) return "この電話番号は存在しないか無効です。番号をご確認ください。";
  if (lookup.lineType && lookup.lineType !== "mobile") {
    return "携帯電話番号を入力してください（固定電話・IP電話は利用できません）。";
  }
  return null;
}

/**
 * Twilio Verify で OTP 検証後、Supabase のセッションを発行する（外部認証→Supabase のブリッジ）。
 * Supabase の phone OTP は使わないため、サービスロールでユーザを作成/更新し、
 * 使い捨てパスワードを設定して signInWithPassword でセッション Cookie を確立する。
 */
async function bridgeSupabaseSession(phone: string): Promise<boolean> {
  const admin = createAdminClient();
  const password = randomBytes(24).toString("base64url"); // 使い捨て（ログイン毎に上書き）

  // GoTrue は auth.users.phone を先頭 + 無しの E.164 で保存し、0015 トリガーが
  // その値を account.users へコピーする。検索もこの形式（+ 無し）に揃える。
  const phoneDigits = phone.replace(/^\+/, "");

  const { data: existing } = await admin
    .schema(SCHEMA.account)
    .from("users")
    .select("id")
    .eq("phone", phoneDigits)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      phone,
      password,
      phone_confirm: true,
    });
    if (error) {
      console.error("admin updateUser error", error);
      return false;
    }
  } else {
    const { error } = await admin.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
    });
    if (error) {
      console.error("admin createUser error", error);
      return false;
    }
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ phone, password });
  if (error) {
    console.error("signInWithPassword error", error);
    return false;
  }
  return true;
}

export async function verifyOtp(_prev: PhoneState, formData: FormData): Promise<PhoneState> {
  const phone = String(formData.get("phone"));
  const token = String(formData.get("token"));

  const approved = await checkVerification(phone, token);
  if (!approved) return { step: "verify", phone, error: "認証コードが正しくありません" };

  const ok = await bridgeSupabaseSession(phone);
  if (!ok) return { step: "verify", phone, error: "ログイン処理に失敗しました。時間をおいて再度お試しください。" };

  revalidatePath("/", "layout");
  redirect(resolvePostLogin(formData.get("redirect") as string | null));
}
