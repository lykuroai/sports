"use client";

import { useActionState } from "react";
import {
  submitNewFacility,
  submitFacilityCorrection,
  type SubmitState,
} from "@/app/facilities/submit/actions";
import { PREFECTURES } from "@/lib/constants";

const initial: SubmitState = { error: null };

type Defaults = Partial<{
  name: string;
  prefecture: string;
  city: string;
  address: string;
  nearest_station: string;
  phone: string;
  website_url: string;
  price_description: string;
  facility_type: string;
}>;

/**
 * 施設の登録・修正申請フォーム。
 * mode="new" は新規登録、mode="correction" は既存施設の修正（facilityId 必須）。
 */
export function FacilitySubmitForm({
  mode,
  facilityId,
  defaults = {},
}: {
  mode: "new" | "correction";
  facilityId?: string;
  defaults?: Defaults;
}) {
  const action = mode === "new" ? submitNewFacility : submitFacilityCorrection;
  const [state, formAction, pending] = useActionState(action, initial);

  if (state.ok) {
    return (
      <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">
        申請を受け付けました。管理者が内容を確認し、承認後に反映されます。
      </p>
    );
  }

  const required = mode === "new";

  return (
    <form action={formAction} className="card space-y-4 p-5">
      {facilityId && <input type="hidden" name="facility_id" value={facilityId} />}

      <div>
        <label className="label" htmlFor="name">施設名{required && <span className="text-red-500">*</span>}</label>
        <input id="name" name="name" className="input" required={required} defaultValue={defaults.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="prefecture">都道府県</label>
          <select id="prefecture" name="prefecture" className="input" defaultValue={defaults.prefecture ?? ""}>
            <option value="">未選択</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="city">市区町村</label>
          <input id="city" name="city" className="input" defaultValue={defaults.city} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="address">住所</label>
        <input id="address" name="address" className="input" defaultValue={defaults.address} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nearest_station">最寄り駅</label>
          <input id="nearest_station" name="nearest_station" className="input" defaultValue={defaults.nearest_station} />
        </div>
        <div>
          <label className="label" htmlFor="facility_type">施設種別</label>
          <input id="facility_type" name="facility_type" className="input" placeholder="例: 体育館 / テニスコート" defaultValue={defaults.facility_type} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="phone">電話番号</label>
          <input id="phone" name="phone" className="input" defaultValue={defaults.phone} />
        </div>
        <div>
          <label className="label" htmlFor="website_url">公式サイト</label>
          <input id="website_url" name="website_url" type="url" className="input" defaultValue={defaults.website_url} placeholder="https://" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="price_description">利用料金</label>
        <input id="price_description" name="price_description" className="input" defaultValue={defaults.price_description} />
      </div>

      <div>
        <label className="label" htmlFor="evidence_url">
          情報の根拠となるURL{required && <span className="text-red-500">*相当</span>}
        </label>
        <input id="evidence_url" name="evidence_url" type="url" className="input" placeholder="公式サイト・自治体ページなど" />
        <p className="mt-1 text-xs text-slate-500">
          正確性確認のため、根拠となるURLの記載にご協力ください。
        </p>
      </div>

      <div>
        <label className="label" htmlFor="comment">補足説明</label>
        <textarea id="comment" name="comment" rows={2} className="input" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "送信中..." : mode === "new" ? "登録を申請する" : "修正を申請する"}
      </button>
    </form>
  );
}
