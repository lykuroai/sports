/**
 * メール・携帯番号の認証が未完了のとき、募集作成/参加申請ができない旨と
 * プロフィール（共通プロフィール = web 内）への導線を表示する。
 */
export function VerifyNotice({
  emailVerified,
  phoneVerified,
}: {
  emailVerified: boolean;
  phoneVerified: boolean;
}) {
  const missing = [
    !emailVerified ? "メールアドレス" : null,
    !phoneVerified ? "携帯番号" : null,
  ].filter(Boolean);
  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
      <p className="font-medium">本人連絡先の認証が必要です</p>
      <p className="mt-1">
        募集の作成・参加申請には{missing.join("・")}の認証が必要です。
      </p>
      <a
        href="/profile"
        className="mt-2 inline-block rounded bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700"
      >
        プロフィールで認証する
      </a>
    </div>
  );
}
