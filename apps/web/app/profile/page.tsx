import { redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import type { RunningUserProfile } from "@spotomo/shared-types";
import { RunningProfileForm } from "./profile-form";

export default async function RunningProfilePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile");

  const { data } = await supabase
    .schema("running")
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">ランニング用プロフィール</h1>
      <p className="text-sm text-slate-500">
        共通プロフィール（ニックネーム等）は
        <a href={`${process.env.NEXT_PUBLIC_ACCOUNT_URL ?? ""}/profile`} className="text-brand hover:underline">共通アカウント</a>
        で編集します。ここはランニング固有の情報のみ。
      </p>
      <RunningProfileForm profile={(data as RunningUserProfile | null) ?? {}} />
    </div>
  );
}
