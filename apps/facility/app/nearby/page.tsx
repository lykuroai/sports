"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@spotomo/auth-client/client";

interface NearbyRow {
  id: string;
  name: string;
  prefecture: string | null;
  city: string | null;
  address: string | null;
}

export default function NearbyPage() {
  const [results, setResults] = useState<NearbyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  function search() {
    setError(null);
    setLoading(true);
    if (!navigator.geolocation) {
      setError("この端末では位置情報を利用できません");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const supabase = createClient();
        const { data, error } = await supabase
          .schema("facility")
          .rpc("nearby_facilities", {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            radius_m: 5000,
            lim: 30,
          });
        if (error) setError(error.message);
        else setResults((data ?? []) as NearbyRow[]);
        setLoading(false);
        setSearched(true);
      },
      () => {
        setError("位置情報を取得できませんでした");
        setLoading(false);
      },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">現在地周辺の施設</h1>
        <p className="text-sm text-slate-500">
          補助機能です。施設検索は地域・駅・地図が主条件で、現在地周辺はその補助という位置付けです。
        </p>
      </div>

      <button className="btn-primary" onClick={search} disabled={loading}>
        {loading ? "検索中..." : "現在地から半径5kmを検索"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {searched && results.length === 0 && !error && (
        <p className="text-slate-500">周辺に施設が見つかりませんでした。</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((f) => (
          <Link key={f.id} href={`/facilities/${f.id}`} className="card p-4 hover:shadow">
            <div className="font-medium">{f.name}</div>
            <div className="text-sm text-slate-500">{f.prefecture}{f.city}{f.address}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
