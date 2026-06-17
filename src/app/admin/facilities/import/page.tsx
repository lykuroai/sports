import { ImportForm } from "./import-form";

export default function AdminFacilityImportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">施設データのCSV取り込み</h1>
      <p className="text-sm text-slate-500">
        自治体オープンデータや提携事業者のCSVを取り込めます（仕様 §6.6）。外部データの利用条件を遵守してください。
        取り込んだ施設は <code>source_type=csv_import</code> として登録され、緯度経度から位置情報（PostGIS）が自動設定されます。
      </p>
      <div className="card p-3 text-xs text-slate-500">
        利用可能な列: name（必須）, facility_type, postal_code, prefecture, city, address,
        latitude, longitude, nearest_station, access_description, phone, website_url,
        reservation_url, price_description, holiday_description
      </div>
      <ImportForm />
    </div>
  );
}
