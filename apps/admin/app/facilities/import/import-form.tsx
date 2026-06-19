"use client";

import { useActionState } from "react";
import { importFacilitiesCsv, type ImportState } from "./actions";

const initial: ImportState = { error: null };

const SAMPLE = "name,facility_type,prefecture,city,address,latitude,longitude\n○○ゴルフ倶楽部,ゴルフ場,千葉県,市原市,...,35.5,140.1";

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importFacilitiesCsv, initial);

  return (
    <form action={formAction} className="card space-y-3 p-4">
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state.imported !== undefined && (
        <p className="rounded bg-green-50 p-2 text-sm text-green-700">{state.imported}件を取り込みました。</p>
      )}
      <label className="label" htmlFor="csv">CSV（1行目はヘッダ）</label>
      <textarea id="csv" name="csv" className="input font-mono" rows={10} defaultValue={SAMPLE} />
      <p className="text-xs text-slate-400">
        取り込める列: name, facility_type, prefecture, city, address, postal_code, latitude, longitude。
        外部データは提供元の利用条件（robots.txt・著作権・再利用条件）を遵守すること。
      </p>
      <button className="btn-primary" type="submit" disabled={pending}>取り込む</button>
    </form>
  );
}
