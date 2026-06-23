"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";

export type VerificationState = { error: string | null; ok?: boolean };

const BUCKET = "verification-docs";

/**
 * 本人確認書類のアップロード＋申請。書類は非公開バケットの本人フォルダへ保存し、
 * account.verifications(type='identity', status='pending') を作成（RLS self insert）。
 * 管理者が審査して承認すると account.users.identity_verified_at が記録される。
 */
export async function submitVerification(
  _prev: VerificationState,
  formData: FormData,
): Promise<VerificationState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/verification");

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "本人確認書類の画像を選択してください。" };
  }
  if (file.size > 8 * 1024 * 1024) return { error: "画像は8MB以下にしてください。" };
  if (!file.type.startsWith("image/")) return { error: "画像ファイルを選択してください。" };

  // 既に審査中の申請があれば二重申請を防ぐ。
  const { data: pending } = await supabase
    .schema(SCHEMA.account)
    .from("verifications")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "identity")
    .eq("status", "pending")
    .maybeSingle();
  if (pending) return { error: "現在審査中の申請があります。結果をお待ちください。" };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/${randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) return { error: `アップロードに失敗しました: ${upErr.message}` };

  const { error } = await supabase
    .schema(SCHEMA.account)
    .from("verifications")
    .insert({ user_id: user.id, type: "identity", evidence_url: path, status: "pending" });
  if (error) return { error: error.message };

  revalidatePath("/verification");
  return { error: null, ok: true };
}
