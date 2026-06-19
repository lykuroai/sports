"use client";

import { useActionState } from "react";
import type { GolfUserProfile } from "@spotomo/shared-types";
import { updateGolfProfile, type GolfProfileState } from "./actions";

const initial: GolfProfileState = { error: null };

export function GolfProfileForm({ profile }: { profile: Partial<GolfUserProfile> }) {
  const [state, formAction, pending] = useActionState(updateGolfProfile, initial);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded bg-green-50 p-2 text-sm text-green-700">保存しました</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="average_score">平均スコア</label>
          <input id="average_score" name="average_score" type="number" className="input" defaultValue={profile.average_score ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="handicap">ハンディキャップ</label>
          <input id="handicap" name="handicap" type="number" step="0.1" className="input" defaultValue={profile.handicap ?? ""} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="preferred_area">希望エリア</label>
        <input id="preferred_area" name="preferred_area" className="input" defaultValue={profile.preferred_area ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="club_owned" value="true" defaultChecked={profile.club_owned ?? false} />
        マイクラブ所有
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="beginner_friendly" value="true" defaultChecked={profile.beginner_friendly ?? true} />
        初心者と一緒でもOK
      </label>

      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "保存中..." : "保存する"}
      </button>
    </form>
  );
}
