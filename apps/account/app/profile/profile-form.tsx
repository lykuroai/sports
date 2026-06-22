"use client";

import { useActionState } from "react";
import { GENDER_LABEL } from "@spotomo/shared-types";
import type { Profile } from "@spotomo/shared-types";
import { updateProfile, type ProfileState } from "./actions";

const initial: ProfileState = { error: null };

export function ProfileForm({
  profile,
  redirectTo = "",
}: {
  profile: Partial<Profile>;
  /** 保存後に戻る先（例: 登録直後の募集作成）。指定時は保存成功でその画面へ遷移する。 */
  redirectTo?: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initial);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <input type="hidden" name="redirect" value={redirectTo} />
      {redirectTo && (
        <p className="rounded bg-blue-50 p-2 text-sm text-blue-700">
          プロフィールを設定して保存すると、元の画面に戻ります。
        </p>
      )}
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded bg-green-50 p-2 text-sm text-green-700">保存しました</p>}

      <div>
        <label className="label" htmlFor="nickname">ニックネーム</label>
        <input id="nickname" name="nickname" className="input" defaultValue={profile.nickname ?? ""} required maxLength={50} />
      </div>
      <div>
        <label className="label" htmlFor="introduction">自己紹介</label>
        <textarea id="introduction" name="introduction" className="input" rows={4} defaultValue={profile.introduction ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="gender">性別</label>
        <select id="gender" name="gender" className="input" defaultValue={profile.gender ?? "unspecified"}>
          {Object.entries(GENDER_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="age_range">年代（例: 30代）</label>
        <input id="age_range" name="age_range" className="input" defaultValue={profile.age_range ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="area">活動エリア</label>
        <input id="area" name="area" className="input" defaultValue={profile.area ?? ""} />
      </div>

      <p className="text-xs text-slate-500">
        ここは全種目で共通の公開プロフィールです。種目固有の情報（ゴルフのハンディキャップ等）は各種目サービスで設定します。
      </p>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "保存中..." : redirectTo ? "保存して戻る" : "保存する"}
      </button>
    </form>
  );
}
