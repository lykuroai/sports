"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";

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
    });

  if (error) return { error: error.message };

  revalidatePath("/profile");

  // 登録直後など戻り先が指定されていれば、保存後にその画面（例: 募集作成）へ遷移する。
  const dest = safeRedirect(formData.get("redirect") as string | null);
  if (dest) redirect(dest);

  return { error: null, ok: true };
}

/**
 * 保存後の戻り先を安全に解決する。相対パス、または account と同じ apex の絶対URLのみ許可し、
 * 外部URL（オープンリダイレクト）は null を返す。種目アプリ（同一 apex のサブドメイン）へ戻す用途。
 */
function safeRedirect(next: string | null): string | null {
  if (!next) return null;
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  try {
    const u = new URL(next);
    const acc = new URL(process.env.NEXT_PUBLIC_ACCOUNT_URL || "http://localhost");
    const apex = (h: string) => h.split(".").slice(-2).join(".");
    if (u.hostname === acc.hostname || apex(u.hostname) === apex(acc.hostname)) {
      return u.toString();
    }
  } catch {
    // 解析不能は破棄
  }
  return null;
}
