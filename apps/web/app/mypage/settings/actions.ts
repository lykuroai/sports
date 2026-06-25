"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";

// 通知設定を保存（本人のみ。RLS で user_id = auth.uid() が保証される）。
export async function saveNotificationSettings(formData: FormData): Promise<void> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage/settings");

  await supabase
    .schema(SCHEMA.account)
    .from("notification_settings")
    .upsert(
      {
        user_id: user.id,
        email_enabled: formData.get("email_enabled") === "on",
        push_enabled: formData.get("push_enabled") === "on",
      },
      { onConflict: "user_id" },
    );
  revalidatePath("/mypage/settings");
}
