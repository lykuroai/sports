"use client";

import { useActionState } from "react";
import { PREFECTURES } from "@spotomo/shared-types";
import type { SubmitState } from "./types";

const initial: SubmitState = { error: null };

type Props = {
  // サーバーアクション（運営者=submitFacility / 一般=registerFacility）を受け取り共用する。
  action: (prev: SubmitState, formData: FormData) => Promise<SubmitState>;
  doneMessage?: string;
};

export function FacilitySubmitForm({ action, doneMessage }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);

  if (state.ok) {
    return (
      <div className="card p-6 text-sm text-green-700">
        {doneMessage ?? "申請を受け付けました。管理者の承認後に施設として公開されます。"}
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-4 p-6">
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}

      <div>
        <label className="label" htmlFor="name">施設名</label>
        <input id="name" name="name" className="input" required maxLength={200} />
      </div>
      <div>
        <label className="label" htmlFor="facility_type">種別（例: ゴルフ場 / 体育館）</label>
        <input id="facility_type" name="facility_type" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="prefecture">都道府県</label>
          <select id="prefecture" name="prefecture" className="input" defaultValue="">
            <option value="">選択</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="city">市区町村</label>
          <input id="city" name="city" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="address">住所</label>
        <input id="address" name="address" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="source_url">出典 URL（推奨）</label>
        <input id="source_url" name="source_url" type="url" className="input" placeholder="https://..." />
      </div>

      <button className="btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "送信中..." : "申請する"}
      </button>
    </form>
  );
}
