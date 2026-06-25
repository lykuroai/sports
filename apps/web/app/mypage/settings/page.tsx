import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient, SCHEMA, selfOrigin } from "@spotomo/auth-client";
import { saveNotificationSettings } from "./actions";

export const metadata = { title: "アカウント設定" };

const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "";

// アカウント設定（mypage_design §15）。通知設定を編集。メール/パスワード/OAuth・
// 公開設定・退会は共通アカウント(account)側に集約しているため導線で誘導する。
export default async function SettingsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage/settings");

  const { data } = await supabase
    .schema(SCHEMA.account).from("notification_settings")
    .select("email_enabled, push_enabled").eq("user_id", user.id).maybeSingle();
  const settings = (data ?? { email_enabled: true, push_enabled: false }) as { email_enabled: boolean; push_enabled: boolean };

  const origin = await selfOrigin();
  const accountHref = (path: string) => (ACCOUNT_URL ? `${ACCOUNT_URL}${path}?redirect=${encodeURIComponent(origin)}` : "/profile");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">アカウント設定</h1>
        <Link href="/mypage" className="text-sm text-brand hover:underline">← マイページ</Link>
      </div>

      <form action={saveNotificationSettings} className="card space-y-4 p-5">
        <h2 className="font-semibold">通知設定</h2>
        <label className="flex items-center justify-between">
          <span className="text-sm">メール通知（参加申請・承認・お知らせ）</span>
          <input type="checkbox" name="email_enabled" defaultChecked={settings.email_enabled} className="h-5 w-5" />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm">アプリ内プッシュ通知</span>
          <input type="checkbox" name="push_enabled" defaultChecked={settings.push_enabled} className="h-5 w-5" />
        </label>
        <button className="btn-primary" type="submit">保存する</button>
      </form>

      <div className="card space-y-2 p-5 text-sm">
        <h2 className="font-semibold">アカウント情報</h2>
        <p className="text-slate-500">メールアドレス・パスワード・外部ログイン連携・プロフィール公開設定・退会は共通アカウントで管理します。</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <a href={accountHref("/profile")} className="text-brand hover:underline">プロフィール編集 →</a>
          <a href={accountHref("/billing")} className="text-brand hover:underline">プレミアム会員 →</a>
        </div>
      </div>
    </div>
  );
}
