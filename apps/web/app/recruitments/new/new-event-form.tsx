"use client";

import { useActionState, useState } from "react";
import { APPROVAL_TYPE_LABEL, PREFECTURES } from "@spotomo/shared-types";
import type { SportOption } from "@spotomo/domain-common";
import { createEvent, type CreateState } from "../actions";
import FacilityPicker, { type PickedFacility } from "./facility-picker";

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
  initialFacility = null,
  initialTitle = "",
  initialPrefecture = "",
}: {
  premium: boolean;
  sports: SportOption[];
  initialFacility?: PickedFacility | null;
  initialTitle?: string;
  initialPrefecture?: string;
}) {
  const [state, formAction, pending] = useActionState(createEvent, initial);
  // 種目は 大分類(親=parent_id null)→小分類(子) で選択する（0032 で階層化）。
  const parents = sports.filter((s) => !s.parent_id);
  const subSports = sports.filter((s) => s.parent_id);
  const defaultParentId = parents.find((p) => p.slug === "cat-running")?.id ?? parents[0]?.id ?? "";
  const [categoryId, setCategoryId] = useState(defaultParentId);
  const [subId, setSubId] = useState("");
  const children = subSports.filter((s) => s.parent_id === categoryId);
  // 小分類があれば小分類、無ければ大分類を種目として送る。
  const sportId = subId || categoryId;
  const [facility, setFacility] = useState<PickedFacility | null>(initialFacility);
  // 施設を選ぶと開催地（都道府県・市区町村）を初期補完する。手入力での上書きも可。
  const [prefecture, setPrefecture] = useState(initialFacility?.prefecture ?? initialPrefecture);
  const [city, setCity] = useState(initialFacility?.city ?? "");

  function handlePick(f: PickedFacility | null) {
    setFacility(f);
    if (f) {
      if (f.prefecture) setPrefecture(f.prefecture);
      if (f.city) setCity(f.city);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">仲間を募集する</h1>
      <p className="text-sm text-slate-500">
        施設や大会から、または直接この画面から募集を作成できます。種目を大分類・小分類で選んでください。
      </p>

      <form action={formAction} className="card space-y-4 p-6">
        {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}

        <div>
          <label className="label" htmlFor="title">タイトル</label>
          <input id="title" name="title" className="input" required maxLength={120} defaultValue={initialTitle} />
        </div>
        {parents.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="category_id">種目（大分類）</label>
              <select id="category_id" className="input" value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); setSubId(""); }}>
                {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="sub_id">小分類</label>
              <select id="sub_id" className="input" value={subId}
                onChange={(e) => setSubId(e.target.value)} disabled={children.length === 0}>
                <option value="">{children.length ? "（指定なし）" : "—"}</option>
                {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <input type="hidden" name="sport_id" value={sportId} />
            <p className="col-span-2 mt-1 text-xs text-slate-400">
              大分類→小分類で種目を選びます。この種目の新着募集メールを希望する利用者に通知されます。
            </p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="description">説明</label>
          <textarea id="description" name="description" className="input" rows={4} />
        </div>

        <div>
          <span className="label">開催施設（任意）</span>
          <input type="hidden" name="facility_id" value={facility?.id ?? ""} />
          <FacilityPicker value={facility} onPick={handlePick} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="prefecture">都道府県</label>
            <select id="prefecture" name="prefecture" className="input" value={prefecture} onChange={(e) => setPrefecture(e.target.value)}>
              <option value="">指定なし</option>
              {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city">市区町村</label>
            <input id="city" name="city" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="event_start_at">開催日時</label>
          <input id="event_start_at" name="event_start_at" type="datetime-local" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="application_deadline">申請締切日時（任意）</label>
          <input id="application_deadline" name="application_deadline" type="datetime-local" className="input" />
          <p className="mt-1 text-xs text-slate-400">締切を過ぎると参加申請を受け付けません。未入力なら締切なし。</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="capacity">募集人数</label>
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

          {subSports.length > 0 && (
            <div>
              <span className="label">趣味・関心のある種目（複数可）</span>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded border border-slate-200 p-2">
                {subSports.map((s) => (
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
