"use client";

import { useActionState } from "react";
import { APPROVAL_TYPE_LABEL, MVP_APPROVAL_TYPES } from "@spotomo/shared-types";
import { createEvent, type CreateState } from "../actions";

const initial: CreateState = { error: null };

export default function NewEventPage() {
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
            <input id="prefecture" name="prefecture" className="input" />
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
        <div>
          <label className="label" htmlFor="approval_type">参加方式</label>
          <select id="approval_type" name="approval_type" className="input">
            {MVP_APPROVAL_TYPES.map((t) => (
              <option key={t} value={t}>{APPROVAL_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="beginner_allowed" value="true" defaultChecked />
          初心者歓迎
        </label>

        <button className="btn-primary w-full" type="submit" disabled={pending}>
          {pending ? "作成中..." : "募集を作成する"}
        </button>
      </form>
    </div>
  );
}
