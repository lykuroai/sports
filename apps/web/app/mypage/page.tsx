import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { fetchMypageCounts } from "@spotomo/domain-common";
import { StatCard } from "@spotomo/shared-ui";

const DOMAIN = "running";

// マイページ（mypage_design）。1アカウントで全種目を横断管理する個人用画面。
// プロフィールカード＋ダッシュボード集計＋主要導線を表示する。
export default async function MyPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage");

  const [counts, profRes] = await Promise.all([
    fetchMypageCounts(supabase, DOMAIN, user.id),
    supabase.schema(SCHEMA.account).from("profiles")
      .select("nickname, avatar_url, introduction, area").eq("user_id", user.id).maybeSingle(),
  ]);
  type Prof = { nickname: string | null; avatar_url: string | null; introduction: string | null; area: string | null };
  const profile = (profRes.data ?? null) as Prof | null;

  // 共通プロフィールは web に取り込み済みのためローカルへ。
  const profileHref = "/profile";

  // プロフィール完成度（簡易）: 主要項目の充足率。
  const filled = [profile?.nickname, profile?.avatar_url, profile?.introduction, profile?.area].filter(Boolean).length;
  const completion = Math.round((filled / 4) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">マイページ</h1>

      {/* プロフィールカード */}
      <div className="card flex items-center gap-4 p-4">
        <span className="flex h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-black/5">
          {profile?.avatar_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            : <span className="flex h-full w-full items-center justify-center text-2xl text-slate-300">👤</span>}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold">{profile?.nickname ?? "（ニックネーム未設定）"}</div>
          <div className="text-sm text-slate-500">{profile?.area ?? "活動エリア未設定"}</div>
          {profile?.introduction && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{profile.introduction}</p>}
        </div>
        <a href={profileHref} className="btn-outline shrink-0 text-sm">編集</a>
      </div>

      {completion < 100 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          プロフィール完成度 {completion}%。主な種目・活動エリア・自己紹介を登録すると、仲間募集に参加しやすくなります。
        </div>
      )}

      {/* ダッシュボード集計 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard href="/mypage/recruitments" label="作成した募集" count={counts.organized} />
        <StatCard href="/mypage/participations" label="参加・応募" count={counts.participating} />
        <StatCard href="/mypage/favorites" label="保存した施設" count={counts.favorites} />
        <StatCard href="/mypage/following" label="フォロー" count={counts.following} />
        <StatCard href="/mypage/followers" label="フォロワー" count={counts.followers} />
      </div>

      {/* 主要導線（CTA） */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/recruitments/new" className="card p-4 text-center font-medium text-brand hover:shadow">仲間募集を作成する</Link>
        <Link href="/recruitments" className="card p-4 text-center font-medium text-brand hover:shadow">募集を探す</Link>
        <Link href="/categories" className="card p-4 text-center font-medium text-brand hover:shadow">種目から探す</Link>
      </div>

      {/* サブ導線 */}
      <nav className="flex flex-wrap gap-4 text-sm text-slate-500">
        <Link href="/mypage/notifications" className="hover:text-brand">通知一覧</Link>
        <Link href="/mypage/settings" className="hover:text-brand">アカウント設定</Link>
      </nav>
    </div>
  );
}
