"use client";

import { useActionState } from "react";
import { importFacilitiesCsv, type ImportState } from "./actions";

const initial: ImportState = { error: null };

const SAMPLE = `name,facility_type,prefecture,city,address,latitude,longitude,nearest_station,phone,website_url,price_description
中央体育館,体育館,東京都,千代田区,神田1-1-1,35.6916,139.7677,神田駅,03-0000-0000,https://example.com,2時間500円`;

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importFacilitiesCsv, initial);

  return (
    <form action={formAction} className="space-y-4">
      {state.inserted !== undefined && (
        <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">
          {state.inserted}件を登録しました。{state.skipped ? `（${state.skipped}件スキップ）` : ""}
        </p>
      )}
      {state.error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}

      <div>
        <label className="label" htmlFor="csv">CSVデータ（1行目をヘッダーとして貼り付け）</label>
        <textarea
          id="csv"
          name="csv"
          rows={12}
          className="input font-mono text-xs"
          placeholder={SAMPLE}
          defaultValue=""
        />
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "取り込み中..." : "取り込む"}
      </button>
    </form>
  );
}
