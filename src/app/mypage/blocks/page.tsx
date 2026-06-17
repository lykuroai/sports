import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toggleBlock } from "@/app/blocks/actions";

export const metadata = { title: "ブロック管理" };

export default async function BlocksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage/blocks");

  const { data: blocks } = await supabase
    .from("blocks")
    .select("blocked_user_id, created_at, profiles:blocked_user_id ( display_name )")
    .eq("blocker_user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ブロック管理</h1>
        <Link href="/mypage" className="text-sm text-brand hover:underline">← マイページ</Link>
      </div>
      <p className="text-sm text-slate-500">
        ブロックした利用者とは、募集への参加申請やフォローができなくなります（仕様 §6.11）。
      </p>

      {(blocks ?? []).length === 0 ? (
        <p className="card p-8 text-center text-slate-500">ブロックしている利用者はいません。</p>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {blocks!.map((b) => (
            <li key={b.blocked_user_id} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">
                {/* @ts-expect-error supabase join 形状 */}
                {b.profiles?.display_name ?? "利用者"}
              </span>
              <form action={toggleBlock}>
                <input type="hidden" name="blocked_user_id" value={b.blocked_user_id} />
                <input type="hidden" name="path" value="/mypage/blocks" />
                <button className="btn-outline px-3 py-1 text-xs">ブロック解除</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
