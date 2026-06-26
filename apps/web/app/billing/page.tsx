import { createServerClient, requireUser, SCHEMA } from "@spotomo/auth-client";
import { startPremiumCheckout, openPortal } from "./actions";

const ACTIVE_STATUSES = ["active", "trialing"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser("/billing");
  const supabase = await createServerClient();

  const [{ data: plan }, { data: sub }] = await Promise.all([
    supabase
      .schema(SCHEMA.account)
      .from("membership_plans")
      .select("name, description, amount, billing_interval, stripe_price_id")
      .eq("code", "premium_member")
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .schema(SCHEMA.account)
      .from("user_subscriptions")
      .select("status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const isPremium = sub ? ACTIVE_STATUSES.includes(sub.status as string) : false;
  const intervalLabel = plan?.billing_interval === "year" ? "年" : "月";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">プレミアム会員</h1>

      {sp.success && (
        <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">
          お手続きありがとうございます。反映まで少し時間がかかる場合があります。
        </p>
      )}
      {sp.canceled && <p className="rounded bg-slate-100 p-2 text-sm text-slate-600">お手続きをキャンセルしました。</p>}
      {sp.error === "price_unset" && (
        <p className="rounded bg-amber-50 p-2 text-sm text-amber-700">
          プランの価格が未設定です（管理者に Stripe Price の設定が必要です）。
        </p>
      )}
      {sp.error === "session" && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">決済セッションの作成に失敗しました。</p>
      )}

      <div className="card space-y-3 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">{plan?.name ?? "プレミアム会員"}</h2>
          {plan && (
            <span className="text-xl font-bold">
              {plan.amount.toLocaleString()}円<span className="text-sm font-normal text-slate-500">/{intervalLabel}</span>
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600">{plan?.description}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>募集の参加者条件（性別・スキル・エリア・趣味）を指定できる</li>
          <li>承認制イベントを作成できる（参加に主催者の承認が必要）</li>
        </ul>

        {isPremium ? (
          <div className="space-y-2">
            <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">
              現在プレミアム会員です（状態: {sub?.status}
              {sub?.cancel_at_period_end ? "・期末に解約予定" : ""}）。
            </p>
            <form action={openPortal}>
              <button className="btn-outline w-full" type="submit">支払い・解約を管理する</button>
            </form>
          </div>
        ) : (
          <form action={startPremiumCheckout}>
            <button className="btn-primary w-full" type="submit" disabled={!plan?.stripe_price_id}>
              プレミアム会員に登録する
            </button>
          </form>
        )}
      </div>

      <p className="text-xs text-slate-400">
        決済は Stripe を通じて行われます。決済顧客情報は種目をまたいだ共通基盤
        （account.billing_customers）で管理します。
      </p>
      <a href="/profile" className="text-brand hover:underline">← プロフィールへ戻る</a>
    </div>
  );
}
