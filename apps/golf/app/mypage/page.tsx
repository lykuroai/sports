import { redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import { fetchMypageCounts } from "@spotomo/domain-common";
import { StatCard } from "@spotomo/shared-ui";

const DOMAIN = "golf";

export default async function MyPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage");

  const counts = await fetchMypageCounts(supabase, DOMAIN, user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">マイページ（ゴルフ）</h1>
      <div className="grid grid-cols-3 gap-3">
        <StatCard href="/mypage/events" label="私の募集" count={counts.organized} />
        <StatCard href="/mypage/participations" label="私の参加" count={counts.participating} />
        <StatCard href="/mypage/favorites" label="お気に入り" count={counts.favorites} />
        <StatCard href="/mypage/following" label="フォロー" count={counts.following} />
        <StatCard href="/mypage/followers" label="フォロワー" count={counts.followers} />
      </div>
    </div>
  );
}
