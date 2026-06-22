"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient, resolvePostLogin } from "@spotomo/auth-client";
import { verifyTurnstile } from "@spotomo/domain-common";

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

  const captcha = await verifyTurnstile(formData.get("cf-turnstile-response") as string | null);
  if (!captcha) return { error: "認証（CAPTCHA）に失敗しました。もう一度お試しください。" };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "メールアドレスまたはパスワードが正しくありません" };

  const redirectTo = resolvePostLogin(formData.get("redirect") as string | null);
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

  const captcha = await verifyTurnstile(formData.get("cf-turnstile-response") as string | null);
  if (!captcha) return { error: "認証（CAPTCHA）に失敗しました。もう一度お試しください。" };

  // 登録後はまずプロフィール設定へ誘導し、保存後に元の目的地（例: 募集作成）へ戻す。
  // 戻り先が無ければ通常どおりプロフィールで止まる。
  const redirectTo = (formData.get("redirect") as string | null) || "";
  const afterProfile = redirectTo
    ? `/profile?redirect=${encodeURIComponent(redirectTo)}`
    : "/profile";

  const supabase = await createServerClient();
  const origin = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "http://localhost:3001";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { nickname: parsed.data.nickname },
      // 確認メールのリンクを PKCE コード交換を行う /auth/callback に通す。
      // verify=email で「認証後はログイン画面へ」を callback に伝える。next で
      // 認証後の最終遷移先（プロフィール設定→元ページ）を引き継ぐ。
      // 未指定だと Supabase の Site URL（ルート）に戻り、セッションが確立しない。
      emailRedirectTo: `${origin}/auth/callback?verify=email&next=${encodeURIComponent(afterProfile)}`,
    },
  });
  if (error) return { error: error.message };

  // メール確認が有効な場合 signUp はセッションを返さない。
  // 確認メール送信を知らせるため、ログイン画面へリダイレクトする（戻り先を保持）。
  if (!data.session) {
    redirect(`/login?notice=check-email${redirectTo ? `&redirect=${encodeURIComponent(afterProfile)}` : ""}`);
  }

  revalidatePath("/", "layout");
  redirect(afterProfile);
}

async function oauthLogin(provider: "google", next?: string | null) {
  const supabase = await createServerClient();
  const origin = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "http://localhost:3001";
  // 元ページ（next）を callback に引き継ぎ、認証後にそこへ戻す。
  const callback = `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback },
  });
  if (error || !data.url) redirect(`/login?error=${provider}`);
  redirect(data.url);
}

export async function loginWithGoogle(formData: FormData) {
  await oauthLogin("google", formData.get("redirect") as string | null);
}

export async function logout() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
