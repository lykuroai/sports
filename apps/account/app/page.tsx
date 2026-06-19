import Link from "next/link";
import { getUser } from "@spotomo/auth-client";
import { redirect } from "next/navigation";

export default async function AccountHome() {
  const user = await getUser();
  if (user) redirect("/profile");

  return (
    <div className="mx-auto max-w-sm space-y-4 text-center">
      <h1 className="text-2xl font-bold">共通アカウント</h1>
      <p className="text-sm text-slate-600">
        ひとつのアカウントで全種目のサービスを利用できます。
      </p>
      <div className="flex flex-col gap-2">
        <Link href="/login" className="btn-primary">ログイン</Link>
        <Link href="/register" className="btn-outline">会員登録</Link>
      </div>
    </div>
  );
}
