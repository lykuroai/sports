import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PREFECTURES } from "@/lib/constants";
import { NearbyButton } from "@/components/nearby-button";

export const metadata = { title: "施設を探す" };

// 仕様 §6.5: 施設検索は地域・駅・地図検索が主条件。現在地周辺は補助。
type SearchParams = Promise<{
  keyword?: string;
  prefecture?: string;
  lat?: string;
  lng?: string;
  radius?: string;
}>;

type FacilityResult = {
  id: string;
  name: string;
  facility_type: string | null;
  prefecture: string | null;
  city: string | null;
  address: string | null;
  nearest_station: string | null;
  distance_m?: number;
};

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

export default async function FacilitiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const lat = sp.lat ? Number(sp.lat) : null;
  const lng = sp.lng ? Number(sp.lng) : null;
  const isNearby = lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng);
  const radius = sp.radius ? Number(sp.radius) : 5000;

  let facilities: FacilityResult[] = [];

  if (isNearby) {
    // PostGIS による近傍検索（仕様 §9.4）
    const { data } = await supabase.rpc("nearby_facilities", {
      lat,
      lng,
      radius_m: radius,
      lim: 50,
    });
    facilities = (data ?? []) as FacilityResult[];
  } else {
    let query = supabase
      .from("facilities")
      .select("id, name, facility_type, prefecture, city, address, nearest_station")
      .is("deleted_at", null)
      .limit(50);
    if (sp.keyword) query = query.ilike("name", `%${sp.keyword}%`);
    if (sp.prefecture) query = query.eq("prefecture", sp.prefecture);
    const { data } = await query;
    facilities = (data ?? []) as FacilityResult[];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">施設を探す</h1>
        <Link href="/facilities/submit" className="btn-outline">施設の登録申請</Link>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        <div className="grow">
          <label className="label" htmlFor="keyword">施設名</label>
          <input id="keyword" name="keyword" defaultValue={sp.keyword} className="input" placeholder="例: 体育館" />
        </div>
        <div>
          <label className="label" htmlFor="prefecture">都道府県</label>
          <select id="prefecture" name="prefecture" defaultValue={sp.prefecture ?? ""} className="input">
            <option value="">すべて</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button className="btn-primary">検索</button>
        <NearbyButton radius={radius} />
      </form>

      {isNearby && (
        <p className="flex items-center justify-between rounded bg-brand/5 px-4 py-2 text-sm text-slate-600">
          <span>現在地から半径{formatDistance(radius)}以内の施設（距離が近い順）</span>
          <Link href="/facilities" className="text-brand hover:underline">条件をクリア</Link>
        </p>
      )}

      {facilities.length === 0 ? (
        <p className="card p-8 text-center text-slate-500">
          {isNearby
            ? "現在地周辺に登録された施設が見つかりませんでした。"
            : "施設が登録されていません。CSV取り込みまたは利用者申請で施設を追加できます（仕様 §6.6）。"}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {facilities.map((f) => (
            <li key={f.id}>
              <Link href={`/facilities/${f.id}`} className="card block p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{f.name}</h3>
                  {f.distance_m !== undefined && (
                    <span className="badge shrink-0 bg-brand/10 text-brand">{formatDistance(f.distance_m)}</span>
                  )}
                </div>
                {f.facility_type && <p className="text-xs text-slate-400">{f.facility_type}</p>}
                <p className="mt-1 text-sm text-slate-600">
                  {f.prefecture ?? ""}{f.city ?? ""}{f.address ?? ""}
                </p>
                {f.nearest_station && (
                  <p className="text-sm text-slate-500">最寄り: {f.nearest_station}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
