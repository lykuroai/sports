"use client";

import { useActionState } from "react";
import { APPROVAL_TYPE_LABEL, PREFECTURES } from "@spotomo/shared-types";
import type { SportOption } from "@spotomo/domain-common";
import { createEvent, type CreateState } from "../actions";

const initial: CreateState = { error: null };

const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "";

const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: "unspecified", label: "指定なし" },
  { value: "male", label: "男性のみ" },
  { value: "female", label: "女性のみ" },
];
const SKILL_OPTIONS: { value: string; label: string }[] = [
  { value: "any", label: "指定なし" },
  { value: "beginner", label: "初級以上" },
  { value: "intermediate", label: "中級以上" },
  { value: "advanced", label: "上級" },
];

export default function NewEventForm({
  premium,
  sports,
}: {
  premium: boolean;
  sports: SportOption[];
}) {
  const [state, formAction, pending] = useActionState(createEvent, initial);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">ランニングの募集を作成</h1>

      <form action={formAction} className="card space-y-4 p-6">
        {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}

        <div>
          <label className="label" htmlFor="title">タイトル</label>
          <input id="title" name="title" className="input" required maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="description">説明</label>
          <textarea id="description" name="description" className="input" rows={4} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="prefecture">都道府県</label>
            <select id="prefecture" name="prefecture" className="input" defaultValue="">
              <option value="">指定なし</option>
              {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city">市区町村</label>
            <input id="city" name="city" className="input" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="event_start_at">開催日時</label>
          <input id="event_start_at" name="event_start_at" type="datetime-local" className="input" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="capacity">定員</label>
            <input id="capacity" name="capacity" type="number" min={1} defaultValue={4} className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="participation_fee">参加費（円）</label>
            <input id="participation_fee" name="participation_fee" type="number" min={0} defaultValue={0} className="input" required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="target_pace">目標ペース（任意）</label>
          <input id="target_pace" name="target_pace" className="input" maxLength={120} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="beginner_allowed" value="true" defaultChecked />
          初心者歓迎
        </label>

        {/* 参加者条件はプレミアム会員のみ。一般会員にも項目は表示するが入力不可（disabled）。 */}
        {!premium && (
          <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            {/* disabled な fieldset 内の入力は送信されないため、参加方式の既定値はここで送る。 */}
            <input type="hidden" name="approval_type" value="first_come" />
            <p className="font-medium text-amber-800">参加者条件はプレミアム会員限定です</p>
            <p className="text-amber-700">
              無料会員の募集は「自由参加（承認不要）」になります。性別・スキル・エリア・趣味などの
              条件指定と承認制にするには、プレミアム会員への登録が必要です。
            </p>
            <a href={`${ACCOUNT_URL}/billing`} className="font-medium text-brand hover:underline">
              プレミアム会員について見る →
            </a>
          </div>
        )}

        <fieldset
          disabled={!premium}
          className={`space-y-3 rounded-lg border border-brand/40 bg-brand/5 p-4 ${
            premium ? "" : "opacity-60"
          }`}
        >
          <legend className="px-1 text-sm font-semibold text-brand">参加者条件（プレミアム会員）</legend>
          {premium && (
            <p className="text-xs text-slate-500">
              条件を指定すると承認制になります。条件は申請者の判断材料として表示され、申請自体はブロックされません。
            </p>
          )}

          <div>
            <label className="label" htmlFor="approval_type">参加方式</label>
            <select id="approval_type" name="approval_type" className="input" defaultValue="approval">
              <option value="approval">{APPROVAL_TYPE_LABEL.approval}</option>
              <option value="first_come">{APPROVAL_TYPE_LABEL.first_come}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="gender_condition">性別</label>
              <select id="gender_condition" name="gender_condition" className="input" defaultValue="unspecified">
                {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="skill_level">スキル</label>
              <select id="skill_level" name="skill_level" className="input" defaultValue="any">
                {SKILL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className="label">エリア（都道府県・複数可）</span>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded border border-slate-200 p-2">
              {PREFECTURES.map((p) => (
                <label key={p} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="condition_prefectures" value={p} />
                  {p}
                </label>
              ))}
            </div>
          </div>

          {sports.length > 0 && (
            <div>
              <span className="label">趣味・関心のある種目（複数可）</span>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded border border-slate-200 p-2">
                {sports.map((s) => (
                  <label key={s.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="condition_sport_ids" value={s.id} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </fieldset>

        <button className="btn-primary w-full" type="submit" disabled={pending}>
          {pending ? "作成中..." : "募集を作成する"}
        </button>
      </form>
    </div>
  );
}
