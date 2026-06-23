import { createServerClient, requireGeneralAccount, resolvePostLogin, SCHEMA } from "@spotomo/auth-client";
import { fetchPublishedSports, fetchUserSports } from "@spotomo/domain-common";
import type { Profile } from "@spotomo/shared-types";
import { logout } from "../actions";
import { ProfileForm } from "./profile-form";
import { ContactSection } from "./contact-section";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 一般会員のみ。施設運営者アカウントは facility アプリへ誘導される。
  const user = await requireGeneralAccount("/profile");
  const supabase = await createServerClient();

  // 登録直後など、保存後に戻る先（例: 募集作成）。requireGeneralAccount の戻り先にも保持。
  const sp = await searchParams;
  const redirectTo = Array.isArray(sp.redirect) ? sp.redirect[0] : sp.redirect ?? "";

  const [{ data }, { data: account }, sports, userSports] = await Promise.all([
    supabase
      .schema(SCHEMA.account)
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .schema(SCHEMA.account)
      .from("users")
      .select("email, phone, email_verified_at, phone_verified_at")
      .eq("id", user.id)
      .maybeSingle(),
    fetchPublishedSports(supabase),
    fetchUserSports(supabase, user.id),
  ]);

  const acc = (account ?? {}) as {
    email?: string | null;
    phone?: string | null;
    email_verified_at?: string | null;
    phone_verified_at?: string | null;
  };

  const profile = (data as Profile | null) ?? {
    nickname: (user.user_metadata?.nickname as string) ?? "",
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">共通プロフィール</h1>
        <div className="flex items-center gap-2">
          {redirectTo && (
            // 保存せず元の画面（例: ゴルフ）へ戻る。戻り先は resolvePostLogin で検証済み。
            <a className="btn-outline" href={resolvePostLogin(redirectTo)}>戻る</a>
          )}
          <form action={logout}>
            <button className="btn-outline" type="submit">ログアウト</button>
          </form>
        </div>
      </div>

      <ContactSection
        email={acc.email ?? user.email ?? ""}
        emailVerified={!!acc.email_verified_at}
        phone={acc.phone ?? ""}
        phoneVerified={!!acc.phone_verified_at}
      />

      <ProfileForm profile={profile} sports={sports} userSports={userSports} redirectTo={redirectTo} />

      <nav className="card divide-y p-2 text-sm">
        <a className="block px-3 py-2 hover:bg-slate-50" href="/notifications">通知一覧</a>
        <a className="block px-3 py-2 hover:bg-slate-50" href="/settings/notifications">通知設定</a>
        <a className="block px-3 py-2 hover:bg-slate-50" href="/billing">決済情報</a>
        <a className="block px-3 py-2 hover:bg-slate-50" href="/verification">本人確認</a>
        <a className="block px-3 py-2 text-red-600 hover:bg-slate-50" href="/withdraw">退会</a>
      </nav>
    </div>
  );
}
