import Link from "next/link";
import type { FollowUser } from "@spotomo/domain-common";

/** ダッシュボードのカウントカード。押すと一覧ページへ遷移する。 */
export function StatCard({
  href,
  label,
  count,
}: {
  href: string;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className="card flex flex-col items-center justify-center gap-1 p-4 text-center transition-shadow hover:shadow-md"
    >
      <span className="text-2xl font-bold tabular-nums">{count}</span>
      <span className="text-sm text-slate-500">{label}</span>
    </Link>
  );
}

/** フォロー／フォロワー一覧の1人分。公開情報（ニックネーム・評価）のみ表示する。 */
export function UserCard({ user, href }: { user: FollowUser; href: string }) {
  const initial = (user.nickname ?? "?").slice(0, 1);
  return (
    <Link href={href} className="card flex items-center gap-3 p-3 transition-shadow hover:shadow-md">
      {user.avatar_url ? (
        // 外部URLの最適化は不要なため img を使用（next/image のドメイン設定回避）。
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          {initial}
        </span>
      )}
      <span className="flex-1 font-medium">{user.nickname ?? "利用者"}</span>
      <span className="text-sm text-slate-400">評価 {(user.rating ?? 0).toFixed(1)}</span>
    </Link>
  );
}
