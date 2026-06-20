"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register, loginWithGoogle, type AuthState } from "../actions";

const initial: AuthState = { error: null };

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(register, initial);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">会員登録</h1>

      <form action={formAction} className="card space-y-4 p-6">
        {state.error && (
          <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>
        )}
        {state.notice && (
          <p className="rounded bg-green-50 p-2 text-sm text-green-700">{state.notice}</p>
        )}
        <div>
          <label className="label" htmlFor="nickname">ニックネーム（公開されます）</label>
          <input id="nickname" name="nickname" type="text" className="input" required maxLength={50} />
        </div>
        <div>
          <label className="label" htmlFor="email">メールアドレス</label>
          <input id="email" name="email" type="email" className="input" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">パスワード（8文字以上）</label>
          <input id="password" name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />
        </div>
        <p className="text-xs text-slate-500">
          本名・生年月日・電話番号・メールアドレスは他の利用者に公開されません。
        </p>
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? "登録中..." : "登録する"}
        </button>
      </form>

      <form action={loginWithGoogle} className="mt-3">
        <button type="submit" className="btn-outline w-full">Googleで登録</button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-600">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="text-brand hover:underline">ログイン</Link>
      </p>
    </div>
  );
}
