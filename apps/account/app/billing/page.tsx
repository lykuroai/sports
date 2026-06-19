export default function Page() {
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">決済情報</h1>
      <p className="text-sm text-slate-600">Stripe 顧客情報（account.billing_customers）。施設運営者サブスク等、種目をまたいだ決済の共通基盤です。</p>
      <a href="/profile" className="text-brand hover:underline">← プロフィールへ戻る</a>
    </div>
  );
}
