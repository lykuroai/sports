"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@spotomo/auth-client";

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

  const phone = toE164(parsed.data);
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { step: "request", phone, error: error.message };

  return { step: "verify", phone, error: null };
}

export async function verifyOtp(_prev: PhoneState, formData: FormData): Promise<PhoneState> {
  const phone = String(formData.get("phone"));
  const token = String(formData.get("token"));
  const supabase = await createServerClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) return { step: "verify", phone, error: "認証コードが正しくありません" };

  revalidatePath("/", "layout");
  redirect("/profile");
}
