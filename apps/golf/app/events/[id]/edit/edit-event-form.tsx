"use client";

import { useActionState } from "react";
import { APPROVAL_TYPE_LABEL, PREFECTURES } from "@spotomo/shared-types";
import type { SportOption } from "@spotomo/domain-common";
import { REGIONS } from "../../../../lib/areas";
import { updateEvent, deleteEvent, type CreateState } from "../../actions";

const initial: CreateState = { error: null };

const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "";

const GENDER_OPTIONS = [
  { value: "unspecified", label: "指定なし" },
  { value: "male", label: "男性のみ" },
  { value: "female", label: "女性のみ" },
];
const SKILL_OPTIONS = [
  { value: "any", label: "指定なし" },
  { value: "beginner", label: "初級以上" },
  { value: "intermediate", label: "中級以上" },
  { value: "advanced", label: "上級" },
];

export interface EventInit {
  id: string;
  title: string;
  description: string | null;
  prefecture: string | null;
  city: string | null;
  event_start_at_local: string; // YYYY-MM-DDTHH:mm
  capacity: number;
  participation_fee: number;
  beginner_allowed: boolean;
  approval_type: string;
  gender_condition: string;
  skill_level: string;
  condition_prefectures: string[];
  condition_sport_ids: string[];
}

export default function EditEventForm({
  event,
  premium,
  sports,
  hasApplicants,
  deleteError,
}: {
  event: EventInit;
  premium: boolean;
  sports: SportOption[];
  hasApplicants: boolean;
  deleteError?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateEvent, initial);
  const prefSet = new Set(event.condition_prefectures);
  const sportSet = new Set(event.condition_sport_ids);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">ゴルフの募集を修正</h1>

      <form action={formAction} className="card space-y-4 p-6">
        {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
        <input type="hidden" name="event_id" value={event.id} />

        <div>
          <label className="label" htmlFor="title">タイトル</label>
          <input id="title" name="title" className="input" required maxLength={120} defaultValue={event.title} />
        </div>
        <div>
          <label className="label" htmlFor="description">説明</label>
          <textarea id="description" name="description" className="input" rows={4} defaultValue={event.description ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="prefecture">都道府県</label>
            <select id="prefecture" name="prefecture" className="input" defaultValue={event.prefecture ?? ""}>
              <option value="">指定なし</option>
              {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city">市区町村</label>
            <input id="city" name="city" className="input" defaultValue={event.city ?? ""} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="event_start_at">開催日時</label>
          <input id="event_start_at" name="event_start_at" type="datetime-local" className="input" required defaultValue={event.event_start_at_local} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="capacity">定員</label>
            <input id="capacity" name="capacity" type="number" min={1} className="input" required defaultValue={event.capacity} />
          </div>
          <div>
            <label className="label" htmlFor="participation_fee">参加費（円）</label>
            <input id="participation_fee" name="participation_fee" type="number" min={0} className="input" required defaultValue={event.participation_fee} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="beginner_allowed" value="true" defaultChecked={event.beginner_allowed} />
          初心者歓迎
        </label>

        {/* 参加者条件はプレミアム会員のみ。一般会員にも項目は表示するが入力不可（disabled）。 */}
        {!premium && (
          <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            <input type="hidden" name="approval_type" value="first_come" />
            <p className="font-medium text-amber-800">参加者条件はプレミアム会員限定です</p>
            <p className="text-amber-700">
              無料会員の募集は「自由参加（承認不要）」になります。条件指定と承認制にはプレミアム会員が必要です。
            </p>
            <a href={`${ACCOUNT_URL}/billing`} className="font-medium text-brand hover:underline">プレミアム会員について見る →</a>
          </div>
        )}

        <fieldset
          disabled={!premium}
          className={`space-y-3 rounded-lg border border-brand/40 bg-brand/5 p-4 ${premium ? "" : "opacity-60"}`}
        >
          <legend className="px-1 text-sm font-semibold text-brand">参加者条件（プレミアム会員）</legend>

          <div>
            <label className="label" htmlFor="approval_type">参加方式</label>
            <select id="approval_type" name="approval_type" className="input" defaultValue={event.approval_type}>
              <option value="approval">{APPROVAL_TYPE_LABEL.approval}</option>
              <option value="first_come">{APPROVAL_TYPE_LABEL.first_come}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="gender_condition">性別</label>
              <select id="gender_condition" name="gender_condition" className="input" defaultValue={event.gender_condition}>
                {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="skill_level">スキル</label>
              <select id="skill_level" name="skill_level" className="input" defaultValue={event.skill_level}>
                {SKILL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className="label">エリア（都道府県・複数可）</span>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded border border-slate-200 p-2">
              {REGIONS.map((r) => (
                <div key={r.name}>
                  <div className="text-xs font-medium text-slate-500">{r.name}</div>
                  <div className="flex flex-wrap gap-2 py-1">
                    {r.prefectures.map((p) => (
                      <label key={p} className="flex items-center gap-1 text-sm">
                        <input type="checkbox" name="condition_prefectures" value={p} defaultChecked={prefSet.has(p)} />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {sports.length > 0 && (
            <div>
              <span className="label">趣味・関心のある種目（複数可）</span>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded border border-slate-200 p-2">
                {sports.map((s) => (
                  <label key={s.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="condition_sport_ids" value={s.id} defaultChecked={sportSet.has(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </fieldset>

        <button className="btn-primary w-full" type="submit" disabled={pending}>
          {pending ? "保存中..." : "修正を保存する"}
        </button>
      </form>

      {/* 削除（ソフトデリート）。応募者がいる募集は削除不可。誤操作防止のため確認ダイアログを挟む。 */}
      <div className="card space-y-2 p-4">
        {deleteError && (
          <p className="rounded bg-red-50 p-2 text-sm text-red-700">
            応募者がいるため、この募集は削除できません。
          </p>
        )}
        {hasApplicants ? (
          <>
            <button type="button" disabled className="cursor-not-allowed text-sm text-slate-400">
              この募集を削除する
            </button>
            <p className="text-xs text-slate-500">
              応募者がいる募集は削除できません。参加者管理でキャンセル対応後に削除してください。
            </p>
          </>
        ) : (
          <form
            action={deleteEvent}
            onSubmit={(e) => {
              if (!confirm("この募集を削除します。よろしいですか？")) e.preventDefault();
            }}
          >
            <input type="hidden" name="event_id" value={event.id} />
            <button type="submit" className="text-sm text-red-600 hover:underline">この募集を削除する</button>
          </form>
        )}
      </div>
    </div>
  );
}
