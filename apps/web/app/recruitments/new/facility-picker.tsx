"use client";

import { useState } from "react";
import { createClient } from "@spotomo/auth-client/client";
import { PREFECTURES } from "@spotomo/shared-types";

export interface PickedFacility {
  id: string;
  name: string;
  prefecture: string | null;
  city: string | null;
  address?: string | null;
}

/**
 * 募集作成時に開催施設を検索して選ぶウィジェット。施設は facility スキーマの共有資産で
 * 公開SELECT（RLS）のためブラウザの anon クライアントから直接検索する。
 */
export default function FacilityPicker({
  value,
  onPick,
}: {
  value: PickedFacility | null;
  onPick: (f: PickedFacility | null) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [pref, setPref] = useState("");
  const [results, setResults] = useState<PickedFacility[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search() {
    setLoading(true);
    const supabase = createClient();
    let q = supabase
      .schema("facility")
      .from("facilities")
      .select("id, name, prefecture, city, address")
      .order("name", { ascending: true })
      .limit(20);
    if (keyword) q = q.ilike("name", `%${keyword}%`);
    if (pref) q = q.eq("prefecture", pref);
    const { data } = await q;
    setResults((data ?? []) as PickedFacility[]);
    setSearched(true);
    setLoading(false);
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded border border-brand/40 bg-brand/5 p-3">
        <div>
          <div className="text-sm font-medium">{value.name}</div>
          <div className="text-xs text-slate-500">{value.prefecture}{value.city}{value.address}</div>
        </div>
        <button type="button" className="btn-outline" onClick={() => onPick(null)}>変更</button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded border border-slate-200 p-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
          placeholder="施設名で検索"
          className="input max-w-[12rem]"
        />
        <select value={pref} onChange={(e) => setPref(e.target.value)} className="input max-w-[8rem]">
          <option value="">都道府県</option>
          {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button type="button" className="btn-outline" onClick={() => void search()} disabled={loading}>
          {loading ? "検索中..." : "施設を検索"}
        </button>
      </div>

      {searched && results.length === 0 && !loading && (
        <p className="text-sm text-slate-400">該当する施設が見つかりません。施設未定のまま作成もできます。</p>
      )}
      {results.length > 0 && (
        <ul className="max-h-56 divide-y overflow-y-auto rounded border border-slate-100">
          {results.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => onPick(f)}
              >
                <span className="text-sm font-medium">{f.name}</span>
                <span className="text-xs text-slate-500">{f.prefecture}{f.city}{f.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-400">施設は任意です。未定のままでも募集を作成できます。</p>
    </div>
  );
}
