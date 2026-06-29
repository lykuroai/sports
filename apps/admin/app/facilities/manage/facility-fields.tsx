import { PREFECTURES } from "@spotomo/shared-types";

// 施設の登録/修正フォームの入力欄（新規・編集で共用するサーバ部品）。
// 値は facilities の実カラムに一致させること（actions がそのまま insert/update する）。
type Values = {
  name?: string | null;
  facility_type?: string | null;
  description?: string | null;
  postal_code?: string | null;
  prefecture?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
};

const STATUSES: { value: string; label: string }[] = [
  { value: "verified", label: "公開（verified）" },
  { value: "unverified", label: "未承認（unverified）" },
  { value: "rejected", label: "却下（rejected）" },
];

export function FacilityFields({ v = {} }: { v?: Values }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="name">施設名 *</label>
        <input id="name" name="name" className="input" required maxLength={200} defaultValue={v.name ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="facility_type">種別（例: ゴルフ場 / 体育館）</label>
          <input id="facility_type" name="facility_type" className="input" maxLength={60} defaultValue={v.facility_type ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="status">公開状態</label>
          <select id="status" name="status" className="input" defaultValue={v.status ?? "verified"}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="postal_code">郵便番号</label>
          <input id="postal_code" name="postal_code" className="input" maxLength={16} defaultValue={v.postal_code ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="prefecture">都道府県</label>
          <select id="prefecture" name="prefecture" className="input" defaultValue={v.prefecture ?? ""}>
            <option value="">選択</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="city">市区町村</label>
        <input id="city" name="city" className="input" maxLength={60} defaultValue={v.city ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="address">住所</label>
        <input id="address" name="address" className="input" maxLength={200} defaultValue={v.address ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="latitude">緯度</label>
          <input id="latitude" name="latitude" className="input" inputMode="decimal" defaultValue={v.latitude ?? ""} placeholder="35.681" />
        </div>
        <div>
          <label className="label" htmlFor="longitude">経度</label>
          <input id="longitude" name="longitude" className="input" inputMode="decimal" defaultValue={v.longitude ?? ""} placeholder="139.767" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">紹介・説明</label>
        <textarea id="description" name="description" className="input" rows={4} maxLength={2000} defaultValue={v.description ?? ""} />
      </div>
    </>
  );
}
