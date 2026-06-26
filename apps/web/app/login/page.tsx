"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Turnstile } from "@spotomo/shared-ui";
import { login, loginWithGoogle, type AuthState } from "../actions";

const initial: AuthState = { error: null };

const NOTICES: Record<string, string> = {
  "check-email": "確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。",
  verified: "メール認証が完了しました。ログインしてください。",
};

function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial);
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "";
  const notice = NOTICES[params.get("notice") ?? ""];

  return (
    <>
      {notice && (
        <p className="mb-3 rounded bg-green-50 p-2 text-sm text-green-700">{notice}</p>
      )}
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
        <Turnstile />
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? "ログイン中..." : "ログイン"}
        </button>
      </form>

      <div className="mt-3 space-y-2">
        <form action={loginWithGoogle}>
          <input type="hidden" name="redirect" value={redirectTo} />
          <button type="submit" className="btn-outline w-full">Googleでログイン</button>
        </form>
        <a
          href={`/auth/line${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className="btn-outline block w-full text-center"
        >
          LINEでログイン
        </a>
        <Link
          href={`/phone${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className="btn-outline block w-full text-center"
        >
          電話番号でログイン
        </Link>
      </div>

      <p className="mt-3 text-center text-xs text-slate-400">
        すべて共通アカウントに集約され、全種目で同じ user_id を利用します。
      </p>

      <p className="mt-4 text-center text-sm text-slate-600">
        アカウントをお持ちでない方は{" "}
        <Link
          href={`/register${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className="text-brand hover:underline"
        >
          会員登録
        </Link>
      </p>
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
    </div>
  );
}
