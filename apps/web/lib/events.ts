import { makeEventRepo, isApplyable } from "@spotomo/domain-common";
import type { DecoratedEvent, EventFilter } from "@spotomo/domain-common";

// ランニング イベントの取得は共通リポジトリ（domain-common）を schema='running' で利用。
const repo = makeEventRepo("running");

export const fetchEvents = repo.fetchEvents;
export const fetchEventDetail = repo.fetchEventDetail;
export { isApplyable };
export type { EventFilter };
export type EventCardData = DecoratedEvent;
