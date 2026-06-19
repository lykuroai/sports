import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";

export default async function OwnerDashboard() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/owner");

  const { data } = await supabase
    .schema(SCHEMA.facility).from("facility_owners")
    .select("facility_id, status").eq("user_id", user.id);

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">施設運営者ダッシュボード</h1>
      <p className="text-sm text-slate-600">verified な施設のみ編集できます（facility.is_owner / RLS）。</p>
      <ul className="card divide-y p-2 text-sm">
        {((data ?? []) as { facility_id: string; status: string }[]).map((o) => (
          <li key={o.facility_id} className="px-3 py-2">{o.facility_id} — {o.status}</li>
        ))}
        {(!data || data.length === 0) && <li className="px-3 py-2 text-slate-400">管理する施設はありません。</li>}
      </ul>
    </div>
  );
}
