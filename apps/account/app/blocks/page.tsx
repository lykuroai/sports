import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { unblock } from "./actions";

export default async function BlocksPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/blocks");

  const { data: blocks } = await supabase
    .schema(SCHEMA.core)
    .from("blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", user.id);

  const ids = (blocks ?? []).map((b: { blocked_id: string }) => b.blocked_id);
  const { data: profiles } = ids.length
    ? await supabase.schema(SCHEMA.account).from("profiles").select("user_id, nickname").in("user_id", ids)
    : { data: [] as { user_id: string; nickname: string }[] };
  const nameMap = new Map((profiles ?? []).map((p: { user_id: string; nickname: string }) => [p.user_id, p.nickname]));

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">ブロックした利用者</h1>
      {ids.length === 0 ? (
        <p className="text-slate-500">ブロック中の利用者はいません。</p>
      ) : (
        <ul className="card divide-y">
          {ids.map((id) => (
            <li key={id} className="flex items-center justify-between p-3 text-sm">
              <span>{nameMap.get(id) ?? id}</span>
              <form action={unblock}>
                <input type="hidden" name="blocked_id" value={id} />
                <button className="btn-outline" type="submit">解除</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-400">ブロックは種目横断（core.blocks）。双方向判定は is_blocked_between で行います。</p>
    </div>
  );
}
