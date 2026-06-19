"use client";

import { useActionState } from "react";
import type { OutdoorUserProfile } from "@spotomo/shared-types";
import { updateOutdoorProfile, type OutdoorProfileState } from "./actions";

const initial: OutdoorProfileState = { error: null };

export function OutdoorProfileForm({ profile }: { profile: Partial<OutdoorUserProfile> }) {
  const [state, formAction, pending] = useActionState(updateOutdoorProfile, initial);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded bg-green-50 p-2 text-sm text-green-700">保存しました</p>}

      <div>
        <label className="label" htmlFor="activity_type">主な活動（例: 登山 / キャンプ）</label>
        <input id="activity_type" name="activity_type" className="input" defaultValue={profile.activity_type ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="experience_level">経験レベル</label>
        <input id="experience_level" name="experience_level" className="input" defaultValue={profile.experience_level ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="gear_owned">所有ギア（カンマ区切り）</label>
        <input id="gear_owned" name="gear_owned" className="input" defaultValue={(profile.gear_owned ?? []).join(", ")} />
      </div>
      <div>
        <label className="label" htmlFor="transportation">移動手段（例: 車 / 公共交通）</label>
        <input id="transportation" name="transportation" className="input" defaultValue={profile.transportation ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="solo_participation_ok" value="true" defaultChecked={profile.solo_participation_ok ?? true} />
        単独参加OK
      </label>

      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "保存中..." : "保存する"}
      </button>
    </form>
  );
}
