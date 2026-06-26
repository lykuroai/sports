export default function Page() {
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">退会</h1>
      <p className="text-sm text-slate-600">退会処理。共通ユーザを withdrawn にし、各種目データは user_id 参照のまま無効化します。</p>
      <a href="/profile" className="text-brand hover:underline">← プロフィールへ戻る</a>
    </div>
  );
}
