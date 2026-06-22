"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Turnstile } from "@spotomo/shared-ui";
import { registerOwner, type AuthState } from "./actions";

const initial: AuthState = { error: null };

const NOTICES: Record<string, string> = {
  "check-email": "確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。",
};

function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerOwner, initial);
  const params = useSearchParams();
  const notice = NOTICES[params.get("notice") ?? ""];

  return (
    <>
      {notice && <p className="mb-3 rounded bg-green-50 p-2 text-sm text-green-700">{notice}</p>}
      <form action={formAction} className="card space-y-4 p-6">
        {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
        <div>
          <label className="label" htmlFor="email">メールアドレス</label>
          <input id="email" name="email" type="email" className="input" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">パスワード</label>
          <input id="password" name="password" type="password" className="input" required autoComplete="new-password" />
        </div>
        <Turnstile />
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? "登録中..." : "施設運営者として登録"}
        </button>
      </form>
    </>
  );
}

export default function OwnerRegisterPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">施設運営者の登録</h1>
      <p className="mb-6 text-sm text-slate-600">
        施設運営者アカウントは一般会員とは別管理です。一般向けの募集参加機能はご利用いただけません。
      </p>
      <Suspense fallback={<div className="card p-6 text-sm text-slate-400">読み込み中...</div>}>
        <RegisterForm />
      </Suspense>
      <p className="mt-4 text-center text-sm text-slate-600">
        すでに登録済みの方は{" "}
        <Link href="/login" className="text-brand hover:underline">ログイン</Link>
      </p>
    </div>
  );
}
