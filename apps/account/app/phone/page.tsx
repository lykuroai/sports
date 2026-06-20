"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Turnstile } from "@spotomo/shared-ui";
import { requestOtp, verifyOtp, type PhoneState } from "./actions";

const reqInitial: PhoneState = { step: "request", phone: "", error: null };
const verInitial: PhoneState = { step: "verify", phone: "", error: null };

export default function PhoneLoginPage() {
  const [reqState, reqAction, reqPending] = useActionState(requestOtp, reqInitial);
  const [verState, verAction, verPending] = useActionState(verifyOtp, verInitial);

  const sent = reqState.step === "verify";

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">電話番号でログイン</h1>

      {!sent ? (
        <form action={reqAction} className="card space-y-4 p-6">
          {reqState.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{reqState.error}</p>}
          <div>
            <label className="label" htmlFor="phone">電話番号</label>
            <input id="phone" name="phone" type="tel" className="input" required placeholder="090-1234-5678" autoComplete="tel" />
            <p className="mt-1 text-xs text-slate-400">SMS で認証コードを送信します。</p>
          </div>
          <Turnstile />
          <button type="submit" className="btn-primary w-full" disabled={reqPending}>
            {reqPending ? "送信中..." : "認証コードを送信"}
          </button>
        </form>
      ) : (
        <form action={verAction} className="card space-y-4 p-6">
          {verState.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{verState.error}</p>}
          <input type="hidden" name="phone" value={reqState.phone} />
          <p className="text-sm text-slate-600">{reqState.phone} に送信したコードを入力してください。</p>
          <div>
            <label className="label" htmlFor="token">認証コード</label>
            <input id="token" name="token" inputMode="numeric" className="input" required autoComplete="one-time-code" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={verPending}>
            {verPending ? "確認中..." : "ログイン"}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-slate-600">
        <Link href="/login" className="text-brand hover:underline">他の方法でログイン</Link>
      </p>
      <p className="text-center text-xs text-slate-400">
        ※ 認証コードは Twilio Verify から SMS で送信されます。
      </p>
    </div>
  );
}
