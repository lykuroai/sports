import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import type { Profile } from "@/lib/database.types";

export const metadata = { title: "プロフィール編集" };

export default async function ProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile/edit");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return <p className="text-slate-500">プロフィールの読み込みに失敗しました。</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">プロフィール編集</h1>
      <ProfileForm profile={profile as Profile} />
    </div>
  );
}
