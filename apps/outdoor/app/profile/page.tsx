import { redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import type { OutdoorUserProfile } from "@spotomo/shared-types";
import { OutdoorProfileForm } from "./profile-form";

export default async function OutdoorProfilePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile");

  const { data } = await supabase
    .schema("outdoor")
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">アウトドア用プロフィール</h1>
      <p className="text-sm text-slate-500">
        共通プロフィール（ニックネーム等）は
        <a href={`${process.env.NEXT_PUBLIC_ACCOUNT_URL ?? ""}/profile`} className="text-brand hover:underline">共通アカウント</a>
        で編集します。ここはアウトドア固有の情報のみ。
      </p>
      <OutdoorProfileForm profile={(data as OutdoorUserProfile | null) ?? {}} />
    </div>
  );
}
