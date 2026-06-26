"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient, createAdminClient, resolvePostLogin, selfOrigin, SCHEMA } from "@spotomo/auth-client";
import { syncUserSports, sendVerification, checkVerification, verifyTurnstile, lookupPhone, type PhoneLookupResult } from "@spotomo/domain-common";

const VALID_LEVELS = new Set(["beginner", "intermediate", "advanced"]);

const schema = z.object({
  nickname: z.string().min(1, "ニックネームを入力してください").max(50),
  introduction: z.string().max(2000).optional(),
  gender: z.enum(["male", "female", "other", "unspecified"]),
  age_range: z.string().optional(),
  area: z.string().optional(),
});

export type ProfileState = { error: string | null; ok?: boolean };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const v = parsed.data;

  // アバター画像（任意）。指定があれば本人フォルダ avatars/<uid>/ にアップロード。
  let avatarUrl: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    if (avatar.size > 5 * 1024 * 1024) return { error: "画像は5MB以下にしてください" };
    if (!avatar.type.startsWith("image/")) return { error: "画像ファイルを選択してください" };
    const ext = avatar.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, avatar, { upsert: true, contentType: avatar.type });
    if (upErr) return { error: `画像のアップロードに失敗しました: ${upErr.message}` };
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    // キャッシュ破棄のためクエリを付与
    avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;
  }

  // account.profiles を upsert（初回ログイン後に行が無い場合に備える）
  const { error } = await supabase
    .schema(SCHEMA.account)
    .from("profiles")
    .upsert({
      user_id: user.id,
      nickname: v.nickname,
      introduction: v.introduction || null,
      gender: v.gender,
      age_range: v.age_range || null,
      area: v.area || null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    });

  if (error) return { error: error.message };

  // 種目選択（選択中の種目のみ sports / level_<id> が送られる）を全置換で保存。
  const selections = formData.getAll("sports").map(String).map((sportId) => {
    const lv = String(formData.get(`level_${sportId}`) ?? "beginner");
    return { sportId, skillLevel: VALID_LEVELS.has(lv) ? lv : "beginner" };
  });
  const sportsResult = await syncUserSports(supabase, user.id, selections);
  if (sportsResult.error) return { error: sportsResult.error };

  revalidatePath("/profile");

  // 登録直後など戻り先が指定されていれば、保存後にその画面（例: 募集作成）へ遷移する。
  // 外部URLは resolvePostLogin が安全に検証する（オープンリダイレクト対策）。
  const redirectTo = formData.get("redirect") as string | null;
  if (redirectTo) redirect(resolvePostLogin(redirectTo));

  return { error: null, ok: true };
}

// ============================================================
// メールアドレス変更（Supabase 確認メール方式）
// ============================================================
export type EmailState = { error: string | null; ok?: boolean };

const emailSchema = z.string().email("メールアドレスの形式が正しくありません");

/**
 * メールアドレス変更。新アドレスへ確認リンクを送る（supabase.auth.updateUser）。
 * リンク確定までは変更は未反映。確定時に auth.users が更新され、0015 トリガーが
 * account.users.email / email_verified_at を同期する。確認リンクの PKCE 交換は
 * web 自身の /auth/callback で行う（単一オリジン。Supabase は絶対URLを要求するため selfOrigin）。
 */
export async function requestEmailChange(
  _prev: EmailState,
  formData: FormData,
): Promise<EmailState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  if (parsed.data === user.email) return { error: "現在のメールアドレスと同じです。" };

  const emailRedirectTo = `${await selfOrigin()}/auth/callback`;
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data },
    { emailRedirectTo },
  );
  if (error) return { error: error.message };
  return { error: null, ok: true };
}

// ============================================================
// 携帯番号 追加/変更（Twilio Verify で OTP 認証）
// ============================================================
export type PhoneVerifyState = { step: "request" | "verify"; phone: string; error: string | null; ok?: boolean };

const phoneSchema = z.string().min(8, "電話番号を入力してください").max(20);

/** 日本の 0始まり番号を E.164（+81…）へ。+ 始まりはそのまま（apps/account/app/phone/actions.ts と同じ）。 */
function toE164(raw: string): string {
  const t = raw.replace(/[\s-]/g, "");
  if (t.startsWith("+")) return t;
  if (t.startsWith("0")) return "+81" + t.slice(1);
  return "+" + t;
}

/** OTP 送信（CAPTCHA 検証つき）。ログイン済みユーザーの番号登録/変更用。 */
export async function requestPhoneOtp(
  _prev: PhoneVerifyState,
  formData: FormData,
): Promise<PhoneVerifyState> {
  const parsed = phoneSchema.safeParse(formData.get("phone"));
  if (!parsed.success) return { step: "request", phone: "", error: parsed.error.errors[0].message };

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
 * 番号の実在チェック（Twilio Lookup）。問題があればエラーメッセージ文字列を、
 * 問題なければ null を返す。Lookup 自体が失敗（認証情報未設定・障害）した場合は
 * フェイルオープン（null）にして OTP 送信を妨げない。
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
 * OTP 検証後、ログイン中ユーザーの携帯番号を確定する。Supabase の電話 OTP は使わず、
 * Twilio で検証 → サービスロールで auth.users を更新（phone_confirm:true）。0015 トリガーが
 * account.users.phone / phone_verified_at を同期する。セッションは張り替えない。
 */
export async function confirmPhoneOtp(
  _prev: PhoneVerifyState,
  formData: FormData,
): Promise<PhoneVerifyState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const phone = String(formData.get("phone"));
  const token = String(formData.get("token"));

  const approved = await checkVerification(phone, token);
  if (!approved) return { step: "verify", phone, error: "認証コードが正しくありません" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, { phone, phone_confirm: true });
  if (error) {
    console.error("admin updateUser phone error", error);
    // 一意制約（他アカウントで使用中）などのケース。
    return { step: "verify", phone, error: "この番号は登録できませんでした。別の番号をお試しください。" };
  }

  revalidatePath("/profile");
  return { step: "verify", phone, error: null, ok: true };
}

// ============================================================
// ログアウト
// ============================================================
/** ログアウトしてトップへ戻す（web には /login が無いため）。 */
export async function logout() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
