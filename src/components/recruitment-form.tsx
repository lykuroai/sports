"use client";

import { useActionState } from "react";
import { createRecruitment, type FormState } from "@/app/recruitments/actions";
import {
  GENDER_CONDITION_OPTIONS,
  MVP_APPROVAL_TYPES,
  APPROVAL_TYPE_LABEL,
  PREFECTURES,
  SKILL_LEVEL_LABEL,
} from "@/lib/constants";
import type { CategoryType, SkillLevel } from "@/lib/database.types";

const initial: FormState = { error: null };

export function RecruitmentForm({
  sports,
}: {
  sports: { id: string; name: string; category_type: CategoryType }[];
}) {
  const [state, formAction, pending] = useActionState(createRecruitment, initial);

  return (
    <form action={formAction} className="card space-y-5 p-6">
      {state.error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>
      )}

      <Field label="募集タイトル" htmlFor="title" required>
        <input id="title" name="title" className="input" required maxLength={120}
          placeholder="例: 【初心者歓迎】日曜午前テニス" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="種目" htmlFor="sport_id" required>
          <select id="sport_id" name="sport_id" className="input" required defaultValue="">
            <option value="" disabled>選択してください</option>
            <optgroup label="スポーツ・レジャー">
              {sports.filter((s) => s.category_type === "sports").map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </optgroup>
            <optgroup label="アウトドア・レジャー">
              {sports.filter((s) => s.category_type === "outdoor").map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </optgroup>
          </select>
        </Field>
        <Field label="参加方式" htmlFor="approval_type" required>
          <select id="approval_type" name="approval_type" className="input" defaultValue="approval">
            {MVP_APPROVAL_TYPES.map((t) => (
              <option key={t} value={t}>{APPROVAL_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="開催日時" htmlFor="event_start_at" required>
          <input id="event_start_at" name="event_start_at" type="datetime-local" className="input" required />
        </Field>
        <Field label="終了予定（任意）" htmlFor="event_end_at">
          <input id="event_end_at" name="event_end_at" type="datetime-local" className="input" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="都道府県" htmlFor="prefecture">
          <select id="prefecture" name="prefecture" className="input" defaultValue="">
            <option value="">未定</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="市区町村" htmlFor="city">
          <input id="city" name="city" className="input" placeholder="例: 渋谷区" />
        </Field>
      </div>

      <Field label="集合場所（任意）" htmlFor="meeting_place">
        <input id="meeting_place" name="meeting_place" className="input"
          placeholder="施設未定の場合は「参加者と相談」のままでも可" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="定員" htmlFor="capacity" required>
          <input id="capacity" name="capacity" type="number" min={1} defaultValue={4} className="input" required />
        </Field>
        <Field label="参加費（円）" htmlFor="participation_fee">
          <input id="participation_fee" name="participation_fee" type="number" min={0} defaultValue={0} className="input" />
        </Field>
        <Field label="経験レベル" htmlFor="skill_level">
          <select id="skill_level" name="skill_level" className="input" defaultValue="any">
            {(Object.keys(SKILL_LEVEL_LABEL) as SkillLevel[]).map((l) => (
              <option key={l} value={l}>{SKILL_LEVEL_LABEL[l]}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="性別条件" htmlFor="gender_condition">
          <select id="gender_condition" name="gender_condition" className="input" defaultValue="unspecified">
            {GENDER_CONDITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="募集締切（任意）" htmlFor="application_deadline">
          <input id="application_deadline" name="application_deadline" type="datetime-local" className="input" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="beginner_allowed" defaultChecked />
        初心者の参加を歓迎する
      </label>

      <Field label="募集の説明" htmlFor="description">
        <textarea id="description" name="description" rows={5} className="input"
          placeholder="活動内容、持ち物、雨天時の対応などを記載してください。" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="雨天時の対応（任意）" htmlFor="rain_policy">
          <input id="rain_policy" name="rain_policy" className="input" />
        </Field>
        <Field label="キャンセル規定（任意）" htmlFor="cancellation_policy">
          <input id="cancellation_policy" name="cancellation_policy" className="input" />
        </Field>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" name="action" value="publish" className="btn-primary flex-1" disabled={pending}>
          {pending ? "処理中..." : "公開する"}
        </button>
        <button type="submit" name="action" value="draft" className="btn-outline" disabled={pending}>
          下書き保存
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
