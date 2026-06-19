"use client";

import { useActionState } from "react";
import type { RunningUserProfile } from "@spotomo/shared-types";
import { updateRunningProfile, type RunProfileState } from "./actions";

const initial: RunProfileState = { error: null };

export function RunningProfileForm({ profile }: { profile: Partial<RunningUserProfile> }) {
  const [state, formAction, pending] = useActionState(updateRunningProfile, initial);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded bg-green-50 p-2 text-sm text-green-700">保存しました</p>}

      <div>
        <label className="label" htmlFor="pace">平均ペース（例: 5:30/km）</label>
        <input id="pace" name="pace" className="input" defaultValue={profile.pace ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="distance_preference">好きな距離（例: 10km / ハーフ）</label>
        <input id="distance_preference" name="distance_preference" className="input" defaultValue={profile.distance_preference ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="race_experience">レース経験</label>
        <input id="race_experience" name="race_experience" className="input" defaultValue={profile.race_experience ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="preferred_time">希望時間帯（例: 早朝 / 夜）</label>
        <input id="preferred_time" name="preferred_time" className="input" defaultValue={profile.preferred_time ?? ""} />
      </div>

      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "保存中..." : "保存する"}
      </button>
    </form>
  );
}
