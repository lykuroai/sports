import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let unread = 0;
  if (user) {
    const [{ data: role }, { count }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);
    isAdmin = !!role;
    unread = count ?? 0;
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand">
          スポともパーク
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/recruitments" className="rounded px-3 py-2 hover:bg-slate-100">
            募集を探す
          </Link>
          <Link href="/facilities" className="rounded px-3 py-2 hover:bg-slate-100">
            施設を探す
          </Link>
          {user ? (
            <>
              <Link href="/recruitments/new" className="btn-primary ml-2">
                募集を作成
              </Link>
              <Link href="/notifications" className="relative rounded px-3 py-2 hover:bg-slate-100">
                通知
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/mypage" className="rounded px-3 py-2 hover:bg-slate-100">
                マイページ
              </Link>
              {isAdmin && (
                <Link href="/admin" className="rounded px-3 py-2 text-brand hover:bg-slate-100">
                  管理画面
                </Link>
              )}
              <form action={logout}>
                <button type="submit" className="rounded px-3 py-2 text-slate-500 hover:bg-slate-100">
                  ログアウト
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded px-3 py-2 hover:bg-slate-100">
                ログイン
              </Link>
              <Link href="/register" className="btn-primary ml-2">
                会員登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
