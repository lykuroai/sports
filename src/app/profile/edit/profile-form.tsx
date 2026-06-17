"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "./actions";
import { GENDER_LABEL, PREFECTURES } from "@/lib/constants";
import type { Gender, Profile } from "@/lib/database.types";

const initial: ProfileState = { error: null };

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateProfile, initial);

  return (
    <form action={formAction} className="card space-y-5 p-6">
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">保存しました。</p>}

      <div>
        <label className="label" htmlFor="display_name">表示名（公開）</label>
        <input id="display_name" name="display_name" className="input" required maxLength={50}
          defaultValue={profile.display_name} />
      </div>

      <div>
        <label className="label" htmlFor="introduction">自己紹介</label>
        <textarea id="introduction" name="introduction" rows={4} className="input"
          defaultValue={profile.introduction ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="gender">性別</label>
          <select id="gender" name="gender" className="input" defaultValue={profile.gender}>
            {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
              <option key={g} value={g}>{GENDER_LABEL[g]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="birth_year">生まれ年（非公開・年代表示に使用）</label>
          <input id="birth_year" name="birth_year" type="number" className="input"
            defaultValue={profile.birth_year ?? ""} placeholder="例: 1995" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="prefecture">居住地域（都道府県）</label>
          <select id="prefecture" name="prefecture" className="input" defaultValue={profile.prefecture ?? ""}>
            <option value="">未設定</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="city">市区町村</label>
          <input id="city" name="city" className="input" defaultValue={profile.city ?? ""} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="activity_area">活動希望地域</label>
        <input id="activity_area" name="activity_area" className="input"
          defaultValue={profile.activity_area ?? ""} placeholder="例: 東京都・神奈川県" />
      </div>

      <p className="text-xs text-slate-500">
        本名・正確な生年月日・電話番号・メールアドレスは他の利用者に公開されません。
      </p>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "保存中..." : "保存する"}
      </button>
    </form>
  );
}
