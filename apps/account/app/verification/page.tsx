export default function Page() {
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">本人確認</h1>
      <p className="text-sm text-slate-600">本人確認の申請・状況（account.verifications）。本人確認は共通基盤で一元化します。</p>
      <a href="/profile" className="text-brand hover:underline">← プロフィールへ戻る</a>
    </div>
  );
}
