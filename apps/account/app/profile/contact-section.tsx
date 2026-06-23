"use client";

import { useActionState, useState } from "react";
import { Turnstile } from "@spotomo/shared-ui";
import { isPlaceholderEmail } from "@spotomo/shared-types";
import {
  requestEmailChange,
  requestPhoneOtp,
  confirmPhoneOtp,
  type EmailState,
  type PhoneVerifyState,
} from "./actions";

const emailInit: EmailState = { error: null };
const reqInit: PhoneVerifyState = { step: "request", phone: "", error: null };
const verInit: PhoneVerifyState = { step: "verify", phone: "", error: null };

function Badge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="badge bg-emerald-100 text-emerald-700">認証済み</span>
  ) : (
    <span className="badge bg-amber-100 text-amber-700">未認証</span>
  );
}

/**
 * 連絡先（メール・携帯番号）の表示と認証フロー。募集作成・参加申請には
 * 両方の認証が必要なため、未認証は目立つよう促す。
 */
export function ContactSection({
  email,
  emailVerified,
  phone,
  phoneVerified,
}: {
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
}) {
  const [emailState, emailAction, emailPending] = useActionState(requestEmailChange, emailInit);
  const [editEmail, setEditEmail] = useState(false);
  // LINE 等でメール未取得時の合成アドレスは「未設定」として扱い、実メールの登録を促す。
  const emailIsPlaceholder = isPlaceholderEmail(email);
  const emailVerifiedReal = emailVerified && !emailIsPlaceholder;

  const [reqState, reqAction, reqPending] = useActionState(requestPhoneOtp, reqInit);
  const [verState, verAction, verPending] = useActionState(confirmPhoneOtp, verInit);
  const [editPhone, setEditPhone] = useState(false);
  const sent = reqState.step === "verify";
  const phoneDone = verState.ok;

  return (
    <section className="card space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">連絡先の認証</h2>
        <span className="text-xs text-slate-400">募集作成・参加申請に必要です</span>
      </div>

      {/* メールアドレス */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="label !mb-0">メールアドレス</span>
          <Badge verified={emailVerifiedReal} />
        </div>
        <p className="text-sm text-slate-700">{emailIsPlaceholder ? "未設定" : email || "未設定"}</p>
        <p className="text-xs text-slate-400">
          {emailIsPlaceholder
            ? "LINE ログインのためメールが未登録です。募集作成・参加申請にはメールの登録が必要です。"
            : "ログインに使うメールアドレスです。他の利用者には公開されません。"}
        </p>

        {!editEmail ? (
          <button type="button" className="btn-outline text-sm" onClick={() => setEditEmail(true)}>
            {emailIsPlaceholder ? "メールを登録" : "メールを変更"}
          </button>
        ) : emailState.ok ? (
          <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">
            新しいメールアドレスに確認メールを送信しました。メール内のリンクから確定してください。
          </p>
        ) : (
          <form action={emailAction} className="space-y-2 rounded border border-slate-200 p-3">
            {emailState.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{emailState.error}</p>}
            <label className="label" htmlFor="new-email">新しいメールアドレス</label>
            <input id="new-email" name="email" type="email" className="input" required autoComplete="email" />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm" disabled={emailPending}>
                {emailPending ? "送信中..." : "確認メールを送る"}
              </button>
              <button type="button" className="btn-outline text-sm" onClick={() => setEditEmail(false)}>
                キャンセル
              </button>
            </div>
            <p className="text-xs text-slate-400">確認リンクをクリックするまで変更は反映されません。</p>
          </form>
        )}
      </div>

      <hr className="border-slate-100" />

      {/* 携帯番号 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="label !mb-0">携帯番号</span>
          <Badge verified={phoneVerified && !editPhone} />
        </div>
        {phone && !editPhone && <p className="text-sm text-slate-700">{phone}</p>}
        <p className="text-xs text-slate-400">SMS 認証に使います。他の利用者には公開されません。</p>

        {phoneDone ? (
          <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">
            携帯番号を認証しました。ページを再読み込みすると反映されます。
          </p>
        ) : phoneVerified && !editPhone ? (
          <button type="button" className="btn-outline text-sm" onClick={() => setEditPhone(true)}>
            番号を変更
          </button>
        ) : !sent ? (
          <form action={reqAction} className="space-y-2 rounded border border-slate-200 p-3">
            {reqState.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{reqState.error}</p>}
            <label className="label" htmlFor="phone">携帯番号</label>
            <input id="phone" name="phone" type="tel" className="input" required placeholder="090-1234-5678" autoComplete="tel" />
            <Turnstile />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm" disabled={reqPending}>
                {reqPending ? "送信中..." : "認証コードを送信"}
              </button>
              {phoneVerified && (
                <button type="button" className="btn-outline text-sm" onClick={() => setEditPhone(false)}>
                  キャンセル
                </button>
              )}
            </div>
          </form>
        ) : (
          <form action={verAction} className="space-y-2 rounded border border-slate-200 p-3">
            {verState.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{verState.error}</p>}
            <input type="hidden" name="phone" value={reqState.phone} />
            <p className="text-sm text-slate-600">{reqState.phone} に送信したコードを入力してください。</p>
            <label className="label" htmlFor="token">認証コード</label>
            <input id="token" name="token" inputMode="numeric" className="input" required autoComplete="one-time-code" />
            <button type="submit" className="btn-primary text-sm" disabled={verPending}>
              {verPending ? "確認中..." : "認証する"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
