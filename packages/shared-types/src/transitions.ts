import type { EventStatus, ParticipantStatus } from "./enums";

// 募集・参加の状態遷移カタログ。種目ごとに重複定義せず、全種目がこれを参照する。
// （依頼: 共通の状態遷移ロジックは packages/domain-common 経由で共有する）

/** 公開検索に出す募集状態（RLS と一致させる）。 */
export const VISIBLE_EVENT_STATUSES: EventStatus[] = ["open", "few_left", "full", "waitlist"];

/** まだ参加申請を受け付けられる状態。 */
export const APPLYABLE_EVENT_STATUSES: EventStatus[] = ["open", "few_left"];

const EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ["open", "cancelled", "private"],
  open: ["few_left", "full", "closed", "cancelled"],
  few_left: ["open", "full", "closed", "cancelled"],
  full: ["few_left", "waitlist", "closed", "cancelled"],
  waitlist: ["full", "few_left", "closed", "cancelled"],
  closed: ["finished", "cancelled"],
  finished: [],
  cancelled: [],
  private: ["open", "draft", "cancelled"],
};

export function canTransitionEvent(from: EventStatus, to: EventStatus): boolean {
  return EVENT_TRANSITIONS[from]?.includes(to) ?? false;
}

const PARTICIPANT_TRANSITIONS: Record<ParticipantStatus, ParticipantStatus[]> = {
  applied: ["approved", "rejected", "waitlist", "cancelled_self"],
  approved: ["cancelled_self", "cancelled_organizer", "attended", "absent", "no_show"],
  waitlist: ["approved", "cancelled_self", "cancelled_organizer"],
  rejected: [],
  cancelled_self: [],
  cancelled_organizer: [],
  attended: [],
  absent: [],
  no_show: [],
};

export function canTransitionParticipant(
  from: ParticipantStatus,
  to: ParticipantStatus,
): boolean {
  return PARTICIPANT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** capacity と承認済み人数から表示用の状態を導出する。 */
export function deriveEventStatus(
  current: EventStatus,
  approvedCount: number,
  capacity: number,
): EventStatus {
  if (current === "cancelled" || current === "closed" || current === "finished") return current;
  if (approvedCount >= capacity) return "full";
  if (capacity > 0 && approvedCount >= capacity - 1) return "few_left";
  return "open";
}
