// 全ドメイン共通の列挙。種目別テーブルでも列名・enum はこのカタログに合わせる。

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "any";
export type Gender = "male" | "female" | "other" | "unspecified";
export type ApprovalType = "approval" | "first_come" | "invite" | "lottery" | "instant";
export type Visibility = "public" | "members" | "unlisted";

/** 募集（=種目イベント）の状態。種目をまたいで共通。 */
export type EventStatus =
  | "draft"
  | "open"
  | "few_left"
  | "full"
  | "waitlist"
  | "closed"
  | "finished"
  | "cancelled"
  | "private";

/** 参加状態。種目をまたいで共通。 */
export type ParticipantStatus =
  | "applied"
  | "approved"
  | "rejected"
  | "waitlist"
  | "cancelled_self"
  | "cancelled_organizer"
  | "attended"
  | "absent"
  | "no_show";

export type AttendanceStatus = "unknown" | "present" | "absent";
export type CategoryType = "sports" | "outdoor";
export type UserStatus = "active" | "suspended" | "banned" | "withdrawn";
export type UserRole = "user" | "organizer" | "facility_owner" | "admin";
export type OwnerStatus = "pending" | "verified" | "rejected" | "revoked";

/** 種目ドメインの識別子。新種目追加時にここへ追加する。 */
export type SportDomain = "golf" | "running" | "outdoor";
