"use client";

import { useActionState, useState } from "react";
import {
  AGE_RANGE_OPTIONS,
  GENDER_LABEL,
  SKILL_LEVEL_LABEL,
  USER_SKILL_LEVELS,
} from "@spotomo/shared-types";
import type { Profile } from "@spotomo/shared-types";
import type { SportOption, UserSportRow } from "@spotomo/domain-common";
import { updateProfile, type ProfileState } from "./actions";

const initial: ProfileState = { error: null };

const CATEGORY_LABEL: Record<string, string> = { sports: "スポーツ", outdoor: "アウトドア" };

/** 種目選択＋種目ごとのレベル。選択中の種目のみ hidden input で送信する。 */
function SportsPicker({
  sports,
  userSports,
}: {
  sports: SportOption[];
  userSports: UserSportRow[];
}) {
  const [sel, setSel] = useState<Record<string, string>>(
    () => Object.fromEntries(userSports.map((u) => [u.sport_id, u.skill_level])),
  );

  const groups = sports.reduce<Record<string, SportOption[]>>((acc, s) => {
    (acc[s.category_type] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <span className="label">取り組む種目とレベル</span>
      <p className="mb-2 text-xs text-slate-500">
        参加・募集の参考に公開されます。種目を選ぶとレベルを設定できます。
      </p>
      <div className="max-h-72 space-y-3 overflow-y-auto rounded border border-slate-200 p-3">
        {Object.entries(groups).map(([cat, items]) => (
          <fieldset key={cat}>
            <legend className="mb-1 text-xs font-semibold text-slate-400">
              {CATEGORY_LABEL[cat] ?? cat}
            </legend>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {items.map((s) => {
                const checked = s.id in sel;
                return (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <label className="flex flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSel((prev) => {
                            const next = { ...prev };
                            if (e.target.checked) next[s.id] = "beginner";
                            else delete next[s.id];
                            return next;
                          })
                        }
                      />
                      {s.name}
                    </label>
                    {checked && (
                      <select
                        className="input max-w-[7rem] py-1 text-xs"
                        value={sel[s.id]}
                        onChange={(e) =>
                          setSel((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                      >
                        {USER_SKILL_LEVELS.map((lv) => (
                          <option key={lv} value={lv}>{SKILL_LEVEL_LABEL[lv]}</option>
                        ))}
                      </select>
                    )}
                    {checked && (
                      <>
                        <input type="hidden" name="sports" value={s.id} />
                        <input type="hidden" name={`level_${s.id}`} value={sel[s.id]} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

export function ProfileForm({
  profile,
  sports,
  userSports,
  redirectTo = "",
}: {
  profile: Partial<Profile>;
  sports: SportOption[];
  userSports: UserSportRow[];
  /** 保存後に戻る先（例: 登録直後の募集作成）。指定時は保存成功でその画面へ遷移する。 */
  redirectTo?: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initial);
  const [preview, setPreview] = useState<string | null>(profile.avatar_url ?? null);

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

      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="アバター" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-slate-500">無</div>
        )}
        <div>
          <label className="label" htmlFor="avatar">プロフィール画像</label>
          <input
            id="avatar"
            name="avatar"
            type="file"
            accept="image/*"
            className="text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : profile.avatar_url ?? null);
            }}
          />
          <p className="text-xs text-slate-500">5MB以下の画像。公開プロフィールに表示されます。</p>
        </div>
      </div>

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
        <label className="label" htmlFor="age_range">年代</label>
        <select id="age_range" name="age_range" className="input" defaultValue={profile.age_range ?? ""}>
          <option value="">未回答</option>
          {AGE_RANGE_OPTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="area">活動エリア</label>
        <input id="area" name="area" className="input" defaultValue={profile.area ?? ""} />
      </div>

      <SportsPicker sports={sports} userSports={userSports} />

      <p className="text-xs text-slate-500">
        ここは全種目で共通の公開プロフィールです。種目固有の情報（ゴルフのハンディキャップ等）は各種目サービスで設定します。
      </p>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "保存中..." : redirectTo ? "保存して戻る" : "保存する"}
      </button>
    </form>
  );
}
