import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@spotomo/auth-client";
import { fetchFollows } from "@spotomo/domain-common";
import { UserCard } from "@spotomo/shared-ui";

const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "";

export default async function FollowingPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage/following");

  const users = await fetchFollows(supabase, user.id, "following");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/mypage" className="text-sm text-brand hover:underline">← マイページ</Link>
      <h1 className="text-2xl font-bold">フォロー</h1>
      {users.length === 0 ? (
        <p className="text-sm text-slate-400">フォロー中の利用者はいません。</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <UserCard key={u.user_id} user={u} href={`${ACCOUNT_URL}/users/${u.user_id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
