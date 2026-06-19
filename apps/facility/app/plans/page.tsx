import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { formatFee } from "@spotomo/shared-types";
import { startCheckout, openPortal } from "./actions";

export default async function PlansPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/plans");

  const [{ data: plans }, { data: owned }, { data: subs }] = await Promise.all([
    supabase.schema(SCHEMA.facility).from("subscription_plans").select("*").eq("is_active", true).order("display_order"),
    supabase.schema(SCHEMA.facility).from("facility_owners").select("facility_id").eq("user_id", user.id).eq("status", "verified"),
    supabase.schema(SCHEMA.facility).from("facility_subscriptions").select("facility_id, status, plan_id").eq("owner_user_id", user.id),
  ]);

  type Plan = { id: string; name: string; description: string | null; amount: number; billing_interval: string; stripe_price_id: string | null };
  type Owned = { facility_id: string };
  const planList = (plans ?? []) as Plan[];
  const facilities = (owned ?? []) as Owned[];
  const subMap = new Map((subs ?? []).map((s: { facility_id: string; status: string }) => [s.facility_id, s.status]));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">施設運営者プラン</h1>
      <p className="text-sm text-slate-500">
        決済顧客は共通基盤（account.billing_customers）で管理し、施設サブスクは facility 側で扱います。
      </p>

      <section className="grid gap-4 sm:grid-cols-2">
        {planList.map((p) => (
          <div key={p.id} className="card space-y-2 p-5">
            <div className="text-lg font-semibold">{p.name}</div>
            <div className="text-2xl font-bold text-brand-dark">
              {formatFee(p.amount)}<span className="text-sm">/{p.billing_interval === "year" ? "年" : "月"}</span>
            </div>
            {p.description && <p className="text-sm text-slate-600">{p.description}</p>}
            {!p.stripe_price_id && <p className="text-xs text-amber-600">stripe_price_id 未設定</p>}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">あなたの施設</h2>
        {facilities.length === 0 ? (
          <p className="text-sm text-slate-400">verified な施設がありません。</p>
        ) : (
          facilities.map((f) => (
            <div key={f.facility_id} className="card flex items-center justify-between p-4 text-sm">
              <div>
                <span className="font-mono text-xs text-slate-400">{f.facility_id}</span>
                <div>状態: {subMap.get(f.facility_id) ?? "未契約"}</div>
              </div>
              <div className="flex gap-2">
                {subMap.has(f.facility_id) ? (
                  <form action={openPortal}>
                    <input type="hidden" name="facility_id" value={f.facility_id} />
                    <button className="btn-outline" type="submit">プラン管理</button>
                  </form>
                ) : (
                  planList[0] && (
                    <form action={startCheckout}>
                      <input type="hidden" name="facility_id" value={f.facility_id} />
                      <input type="hidden" name="plan_id" value={planList[0].id} />
                      <button className="btn-primary" type="submit">{planList[0].name}を契約</button>
                    </form>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
