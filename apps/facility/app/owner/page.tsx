import { createServerClient, requireOwnerAccount, SCHEMA } from "@spotomo/auth-client";
import { OWNER_STATUS_LABEL } from "@spotomo/shared-types";

export default async function OwnerDashboard() {
  // 施設運営者アカウント（または既存 verified オーナー）のみ。一般会員は弾く。
  const user = await requireOwnerAccount();
  const supabase = await createServerClient();

  const { data } = await supabase
    .schema(SCHEMA.facility).from("facility_owners")
    .select("facility_id, status").eq("user_id", user.id);
  const rows = (data ?? []) as { facility_id: string; status: string }[];

  const ids = rows.map((r) => r.facility_id);
  const { data: facs } = ids.length
    ? await supabase.schema(SCHEMA.facility).from("facilities").select("id, name").in("id", ids)
    : { data: [] as { id: string; name: string }[] };
  const nameMap = new Map((facs ?? []).map((f: { id: string; name: string }) => [f.id, f.name]));

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">施設運営者ダッシュボード</h1>
      <p className="text-sm text-slate-600">承認済みの施設のみ編集できます（facility.is_owner / RLS）。施設ページから運営者申請ができます。</p>
      <ul className="card divide-y p-2 text-sm">
        {rows.map((o) => (
          <li key={o.facility_id} className="flex items-center justify-between px-3 py-2">
            <a href={`/facilities/${o.facility_id}`} className="hover:underline">
              {nameMap.get(o.facility_id) ?? o.facility_id}
            </a>
            <span className={o.status === "verified" ? "text-emerald-700" : "text-slate-500"}>
              {OWNER_STATUS_LABEL[o.status] ?? o.status}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-3 py-2 text-slate-400">管理する施設はありません。</li>}
      </ul>
    </div>
  );
}
