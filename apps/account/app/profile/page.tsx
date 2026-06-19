import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import type { Profile } from "@spotomo/shared-types";
import { logout } from "../actions";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile");

  const { data } = await supabase
    .schema(SCHEMA.account)
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (data as Profile | null) ?? {
    nickname: (user.user_metadata?.nickname as string) ?? "",
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">共通プロフィール</h1>
        <form action={logout}>
          <button className="btn-outline" type="submit">ログアウト</button>
        </form>
      </div>

      <ProfileForm profile={profile} />

      <nav className="card divide-y p-2 text-sm">
        <a className="block px-3 py-2 hover:bg-slate-50" href="/settings/notifications">通知設定</a>
        <a className="block px-3 py-2 hover:bg-slate-50" href="/billing">決済情報</a>
        <a className="block px-3 py-2 hover:bg-slate-50" href="/verification">本人確認</a>
        <a className="block px-3 py-2 text-red-600 hover:bg-slate-50" href="/withdraw">退会</a>
      </nav>
    </div>
  );
}
