"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient, resolvePostLogin, SCHEMA } from "@spotomo/auth-client";
import { syncUserSports } from "@spotomo/domain-common";

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
