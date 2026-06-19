import { makeEventRepo, isApplyable } from "@spotomo/domain-common";
import type { DecoratedEvent, EventFilter } from "@spotomo/domain-common";

// golf イベントの取得は共通リポジトリ（domain-common）を schema='golf' で利用。
const repo = makeEventRepo("golf");

export const fetchEvents = repo.fetchEvents;
export const fetchEventDetail = repo.fetchEventDetail;
export { isApplyable };
export type { EventFilter };
export type EventCardData = DecoratedEvent;
