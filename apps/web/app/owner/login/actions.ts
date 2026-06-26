"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@spotomo/auth-client";
import { verifyTurnstile } from "@spotomo/domain-common";

const schema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

export type AuthState = { error: string | null };

/** 施設運営者のログイン。セッションはサブドメイン共有 Cookie で全 app に有効。 */
export async function loginOwner(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const captcha = await verifyTurnstile(formData.get("cf-turnstile-response") as string | null);
  if (!captcha) return { error: "認証（CAPTCHA）に失敗しました。もう一度お試しください。" };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "メールアドレスまたはパスワードが正しくありません" };

  const redirectTo = formData.get("redirect") as string | null;
  revalidatePath("/", "layout");
  redirect(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/owner");
}
