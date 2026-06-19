"use client";

import { useState, useTransition } from "react";
import { toggleFollowAction } from "./social-actions";

export function FollowButton({ organizerId, initial }: { organizerId: string; initial: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-outline"
      disabled={pending}
      onClick={() => start(async () => setFollowing(await toggleFollowAction(organizerId)))}
    >
      {following ? "フォロー中" : "＋ 主催者をフォロー"}
    </button>
  );
}
