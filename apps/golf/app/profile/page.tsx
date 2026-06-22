import { redirect } from "next/navigation";
import { createServerClient, selfOrigin } from "@spotomo/auth-client";
import type { GolfUserProfile } from "@spotomo/shared-types";
import { GolfProfileForm } from "./profile-form";

export default async function GolfProfilePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile");

  const { data } = await supabase
    .schema("golf")
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // 共通アカウントで編集後、ここ（ゴルフ）へ戻れるよう redirect を引き継ぐ。
  // 戻り先は account 側の resolvePostLogin が同一 apex のみ許可して検証する。
  const back = `${await selfOrigin()}/profile`;
  const accountProfileUrl = `${process.env.NEXT_PUBLIC_ACCOUNT_URL ?? ""}/profile?redirect=${encodeURIComponent(back)}`;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">ゴルフ用プロフィール</h1>
      <p className="text-sm text-slate-500">
        共通プロフィール（ニックネーム等）は
        <a href={accountProfileUrl} className="text-brand hover:underline">共通アカウント</a>
        で編集します。ここはゴルフ固有の情報のみ。
      </p>
      <GolfProfileForm profile={(data as GolfUserProfile | null) ?? {}} />
    </div>
  );
}
