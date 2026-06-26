"use client";

import { useActionState } from "react";
import type { SportOption } from "@spotomo/domain-common";
import { updateNewRecruitmentPrefs, type NotifySettingsState } from "./actions";

const initial: NotifySettingsState = { error: null };

// core.sports.category_type の表示ラベル。
const CATEGORY_LABEL: Record<string, string> = {
  sports: "スポーツ・レジャー",
  outdoor: "アウトドア・レジャー",
};

export function NewRecruitmentForm({
  sports,
  selectedSportIds,
}: {
  sports: SportOption[];
  selectedSportIds: string[];
}) {
  const [state, action, pending] = useActionState(updateNewRecruitmentPrefs, initial);
  const selected = new Set(selectedSportIds);

  // 区分（category_type）ごとにまとめて表示する。
  const groups = sports.reduce<Record<string, SportOption[]>>((acc, s) => {
    (acc[s.category_type] ??= []).push(s);
    return acc;
  }, {});

  return (
    <form action={action} className="card space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="font-semibold">新規募集のメール通知</h2>
        <p className="text-xs text-slate-500">
          選んだ種目で新しい募集が公開されたとき、メールでお知らせします。
          初期状態ではオフです（受信したい種目だけ選んでください）。
          メール通知全体をオフにしている場合はアプリ内通知のみ届きます。
        </p>
      </div>

      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded bg-green-50 p-2 text-sm text-green-700">保存しました</p>}

      {Object.entries(groups).map(([categoryType, list]) => (
        <fieldset key={categoryType} className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">
            {CATEGORY_LABEL[categoryType] ?? categoryType}
          </legend>
          <div className="flex flex-wrap gap-2 rounded border border-slate-200 p-2">
            {list.map((s) => (
              <label key={s.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name="new_recruitment_sport_ids"
                  value={s.id}
                  defaultChecked={selected.has(s.id)}
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "保存中..." : "保存"}
      </button>
    </form>
  );
}
