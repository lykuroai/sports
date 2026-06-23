import { redirect } from "next/navigation";
import { createServerClient, selfOrigin } from "@spotomo/auth-client";
import { fetchMypageCounts } from "@spotomo/domain-common";
import { StatCard } from "@spotomo/shared-ui";

const DOMAIN = "outdoor";
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "";

export default async function MyPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage");

  const counts = await fetchMypageCounts(supabase, DOMAIN, user.id);
  // 共通プロフィール（account）への導線。編集後はこの種目アプリへ戻す。
  const origin = await selfOrigin();
  const profileHref = ACCOUNT_URL
    ? `${ACCOUNT_URL}/profile?redirect=${encodeURIComponent(origin)}`
    : "/profile";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">マイページ（アウトドア）</h1>
      <div className="grid grid-cols-3 gap-3">
        <StatCard href="/mypage/events" label="私の募集" count={counts.organized} />
        <StatCard href="/mypage/participations" label="私の参加" count={counts.participating} />
        <StatCard href="/mypage/favorites" label="お気に入り" count={counts.favorites} />
        <StatCard href="/mypage/following" label="フォロー" count={counts.following} />
        <StatCard href="/mypage/followers" label="フォロワー" count={counts.followers} />
      </div>
      <a
        href={profileHref}
        className="card flex items-center justify-between p-4 transition-shadow hover:shadow-md"
      >
        <span className="font-medium">プロフィール</span>
        <span className="text-sm text-slate-400">編集する →</span>
      </a>
    </div>
  );
}
