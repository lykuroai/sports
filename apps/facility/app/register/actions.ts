"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@spotomo/auth-client";
import { verifyTurnstile } from "@spotomo/domain-common";
import { facilityOrigin } from "@/lib/stripe";

const schema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

export type AuthState = { error: string | null };

/**
 * 施設運営者アカウントの新規登録。一般会員とは別種別（account_type='facility_owner'）で
 * 作成し、一般プロフィール(account.profiles)は持たない（DB トリガーが種別で出し分ける）。
 */
export async function registerOwner(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const captcha = await verifyTurnstile(formData.get("cf-turnstile-response") as string | null);
  if (!captcha) return { error: "認証（CAPTCHA）に失敗しました。もう一度お試しください。" };

  const supabase = await createServerClient();
  const origin = facilityOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // 種別を auth メタデータで渡す。handle_new_user トリガーが account_type を設定する。
      data: { account_type: "facility_owner" },
      emailRedirectTo: `${origin}/auth/callback?verify=email`,
    },
  });
  if (error) return { error: error.message };

  if (!data.session) redirect("/login?notice=check-email");
  redirect("/owner");
}
