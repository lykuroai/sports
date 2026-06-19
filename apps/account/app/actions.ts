"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@spotomo/auth-client";

const credsSchema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

export type AuthState = { error: string | null };

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "メールアドレスまたはパスワードが正しくありません" };

  const redirectTo = (formData.get("redirect") as string) || "/profile";
  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const schema = credsSchema.extend({
    nickname: z.string().min(1, "ニックネームを入力してください").max(50),
  });
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { nickname: parsed.data.nickname } },
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/profile");
}

async function oauthLogin(provider: "google" | "apple") {
  const supabase = await createServerClient();
  const origin = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "http://localhost:3001";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect(`/login?error=${provider}`);
  redirect(data.url);
}

export async function loginWithGoogle() {
  await oauthLogin("google");
}

export async function loginWithApple() {
  await oauthLogin("apple");
}

export async function logout() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
