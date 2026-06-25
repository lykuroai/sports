"use client";

import { useState, useTransition } from "react";
import { toggleFavoriteAction } from "./social-actions";

export function FavoriteButton({ eventId, initial }: { eventId: string; initial: boolean }) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-outline"
      disabled={pending}
      onClick={() => start(async () => setFav(await toggleFavoriteAction(eventId)))}
    >
      {fav ? "★ お気に入り解除" : "☆ お気に入り"}
    </button>
  );
}
