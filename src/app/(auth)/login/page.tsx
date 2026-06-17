"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login, loginWithGoogle, type AuthState } from "../actions";

const initial: AuthState = { error: null };

function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial);
  const redirectTo = useSearchParams().get("redirect") ?? "";

  return (
    <>
      <form action={formAction} className="card space-y-4 p-6">
        <input type="hidden" name="redirect" value={redirectTo} />
        {state.error && (
          <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>
        )}
        <div>
          <label className="label" htmlFor="email">メールアドレス</label>
          <input id="email" name="email" type="email" className="input" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">パスワード</label>
          <input id="password" name="password" type="password" className="input" required autoComplete="current-password" />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? "ログイン中..." : "ログイン"}
        </button>
      </form>

      <form action={loginWithGoogle} className="mt-3">
        <button type="submit" className="btn-outline w-full">Googleでログイン</button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">ログイン</h1>

      <Suspense fallback={<div className="card p-6 text-sm text-slate-400">読み込み中...</div>}>
        <LoginForm />
      </Suspense>

      <p className="mt-4 text-center text-sm text-slate-600">
        アカウントをお持ちでない方は{" "}
        <Link href="/register" className="text-brand hover:underline">会員登録</Link>
      </p>
    </div>
  );
}
