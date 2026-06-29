"use client";

import { useActionState } from "react";
import Link from "next/link";
import { PREFECTURES } from "@spotomo/shared-types";
import type { SubmitState } from "../../_components/types";

const initial: SubmitState = { error: null };

type FacilityValues = {
  id: string;
  name: string | null;
  facility_type: string | null;
  description: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function FacilityEditForm({
  action,
  facility,
}: {
  action: (prev: SubmitState, formData: FormData) => Promise<SubmitState>;
  facility: FacilityValues;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      <input type="hidden" name="facility_id" value={facility.id} />

      <div>
        <label className="label" htmlFor="name">施設名</label>
        <input id="name" name="name" className="input" required maxLength={200} defaultValue={facility.name ?? ""} />
      </div>

      <div>
        <label className="label" htmlFor="facility_type">種別（例: ゴルフ場 / 体育館）</label>
        <input id="facility_type" name="facility_type" className="input" maxLength={60} defaultValue={facility.facility_type ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="postal_code">郵便番号</label>
          <input id="postal_code" name="postal_code" className="input" maxLength={16} defaultValue={facility.postal_code ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="prefecture">都道府県</label>
          <select id="prefecture" name="prefecture" className="input" defaultValue={facility.prefecture ?? ""}>
            <option value="">選択</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="city">市区町村</label>
        <input id="city" name="city" className="input" maxLength={60} defaultValue={facility.city ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="address">住所</label>
        <input id="address" name="address" className="input" maxLength={200} defaultValue={facility.address ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="latitude">緯度</label>
          <input id="latitude" name="latitude" className="input" inputMode="decimal" defaultValue={facility.latitude ?? ""} placeholder="35.681" />
        </div>
        <div>
          <label className="label" htmlFor="longitude">経度</label>
          <input id="longitude" name="longitude" className="input" inputMode="decimal" defaultValue={facility.longitude ?? ""} placeholder="139.767" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">紹介・説明</label>
        <textarea id="description" name="description" className="input" rows={4} maxLength={2000} defaultValue={facility.description ?? ""} />
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "保存中..." : "保存する"}
        </button>
        <Link href={`/facilities/${facility.id}`} className="text-sm text-slate-500 hover:underline">キャンセル</Link>
      </div>
    </form>
  );
}
