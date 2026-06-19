export default function Page() {
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">通知設定</h1>
      <p className="text-sm text-slate-600">メール・プッシュ通知の受信設定（account.notification_settings）。共通基盤で全種目の通知を一元管理します。</p>
      <a href="/profile" className="text-brand hover:underline">← プロフィールへ戻る</a>
    </div>
  );
}
