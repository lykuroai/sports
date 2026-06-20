"use client";

import { useActionState } from "react";
import { APPROVAL_TYPE_LABEL, MVP_APPROVAL_TYPES } from "@spotomo/shared-types";
import { createEvent, type CreateState } from "../actions";

const initial: CreateState = { error: null };

export interface GoraPrefill {
  course_id: string;
  course_name: string;
  prefecture?: string;
  address?: string;
  course_url?: string;
  plan_id: string;
  plan_name: string;
  price?: string;
  play_date?: string; // YYYY-MM-DD
  start_time?: string;
  lunch?: string;
  caddie?: string;
  cart?: string;
  two_sum?: string;
  reserve_url?: string;
}

export default function NewEventForm({ gora }: { gora: GoraPrefill | null }) {
  const [state, formAction, pending] = useActionState(createEvent, initial);

  const defaultTitle = gora ? `【${gora.course_name}】${gora.plan_name}で一緒にラウンドしませんか` : "";
  const defaultFee = gora?.price ?? "0";
  // play_date を datetime-local の初期値（その日の 08:00）へ。
  const defaultStart = gora?.play_date ? `${gora.play_date}T08:00` : "";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">ゴルフの募集を作成</h1>

      {gora && (
        <div className="card space-y-1 p-4 text-sm">
          <p className="font-medium">楽天GORAのプランを紐づけます</p>
          <p className="text-slate-600">{gora.course_name}</p>
          <p className="text-slate-600">
            {gora.plan_name}
            {gora.play_date ? `・${gora.play_date}` : ""}
            {gora.start_time ? `・${gora.start_time}` : ""}
            {gora.price ? `・${Number(gora.price).toLocaleString()}円` : ""}
          </p>
          <p className="text-xs text-slate-400">
            予約確定は楽天GORAの予約ページで行います。募集後、主催者が予約状態を更新できます。
          </p>
        </div>
      )}

      <form action={formAction} className="card space-y-4 p-6">
        {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}

        {/* 楽天GORA 引き継ぎ（hidden）。createEvent が event_golf_details 等へ保存。 */}
        {gora && (
          <>
            <input type="hidden" name="gora_course_id" value={gora.course_id} />
            <input type="hidden" name="gora_course_name" value={gora.course_name} />
            <input type="hidden" name="gora_prefecture" value={gora.prefecture ?? ""} />
            <input type="hidden" name="gora_address" value={gora.address ?? ""} />
            <input type="hidden" name="gora_course_url" value={gora.course_url ?? ""} />
            <input type="hidden" name="gora_plan_id" value={gora.plan_id} />
            <input type="hidden" name="gora_plan_name" value={gora.plan_name} />
            <input type="hidden" name="gora_price" value={gora.price ?? ""} />
            <input type="hidden" name="gora_play_date" value={gora.play_date ?? ""} />
            <input type="hidden" name="gora_start_time" value={gora.start_time ?? ""} />
            <input type="hidden" name="gora_lunch" value={gora.lunch ?? ""} />
            <input type="hidden" name="gora_caddie" value={gora.caddie ?? ""} />
            <input type="hidden" name="gora_cart" value={gora.cart ?? ""} />
            <input type="hidden" name="gora_two_sum" value={gora.two_sum ?? ""} />
            <input type="hidden" name="gora_reserve_url" value={gora.reserve_url ?? ""} />
          </>
        )}

        <div>
          <label className="label" htmlFor="title">タイトル</label>
          <input id="title" name="title" className="input" required maxLength={120} defaultValue={defaultTitle} />
        </div>
        <div>
          <label className="label" htmlFor="description">説明</label>
          <textarea id="description" name="description" className="input" rows={4} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="prefecture">都道府県</label>
            <input id="prefecture" name="prefecture" className="input" defaultValue={gora?.prefecture ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="city">市区町村</label>
            <input id="city" name="city" className="input" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="event_start_at">開催日時</label>
          <input id="event_start_at" name="event_start_at" type="datetime-local" className="input" required defaultValue={defaultStart} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="capacity">定員</label>
            <input id="capacity" name="capacity" type="number" min={1} defaultValue={4} className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="participation_fee">参加費（円）</label>
            <input id="participation_fee" name="participation_fee" type="number" min={0} defaultValue={defaultFee} className="input" required />
          </div>
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
