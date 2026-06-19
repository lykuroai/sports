import type {
  ApprovalType,
  AttendanceStatus,
  EventStatus,
  Gender,
  ParticipantStatus,
  SkillLevel,
  Visibility,
} from "./enums";

// ===== 種目スキーマ共通形（golf / running / outdoor が共有する列） =====
// テーブルは種目ごとに分かれる（golf.events 等）が、共通列はこの基底型に揃える。

/** 種目イベント（=仲間募集）の共通列。種目固有列は各種目で拡張する。 */
export interface SportEventBase {
  id: string;
  organizer_id: string;
  sport_id: string;
  facility_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  prefecture: string | null;
  city: string | null;
  location_description: string | null;
  meeting_place: string | null;
  event_start_at: string;
  event_end_at: string | null;
  meeting_at: string | null;
  application_deadline: string | null;
  capacity: number;
  participation_fee: number;
  payment_method: string | null;
  target_age_min: number | null;
  target_age_max: number | null;
  gender_condition: Gender;
  skill_level: SkillLevel;
  beginner_allowed: boolean;
  approval_type: ApprovalType;
  visibility: Visibility;
  rain_policy: string | null;
  cancellation_policy: string | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** 参加者の共通列。 */
export interface SportParticipantBase {
  event_id: string;
  user_id: string;
  status: ParticipantStatus;
  application_message: string | null;
  skill_level: SkillLevel | null;
  equipment_status: string | null;
  organizer_note: string | null;
  applied_at: string;
  approved_at: string | null;
  cancelled_at: string | null;
  attendance_status: AttendanceStatus;
}

// ---- チャット（イベント単位。各種目スキーマに同型で存在） ----

export interface ChatRoom {
  id: string;
  event_id: string;
  status: "active" | "closed";
  created_at: string;
}

export interface ChatRoomMember {
  chat_room_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  role: "organizer" | "participant";
}

export interface ChatMessage {
  id: string;
  chat_room_id: string;
  sender_id: string | null;
  message_type: "text" | "image" | "location" | "announcement" | "system";
  message: string | null;
  image_url: string | null;
  created_at: string;
  deleted_at: string | null;
}

// ---- 種目別プロフィール（共通 user_id を参照。認証情報は持たない） ----

export interface GolfUserProfile {
  user_id: string;
  average_score: number | null;
  handicap: number | null;
  preferred_area: string | null;
  available_days: string[] | null;
  club_owned: boolean;
  beginner_friendly: boolean;
}

export interface RunningUserProfile {
  user_id: string;
  pace: string | null;
  distance_preference: string | null;
  race_experience: string | null;
  preferred_time: string | null;
}

export interface OutdoorUserProfile {
  user_id: string;
  activity_type: string | null;
  experience_level: string | null;
  gear_owned: string[] | null;
  transportation: string | null;
  solo_participation_ok: boolean;
}

// 種目固有イベント型（共通列 + 固有列）の例。
export interface GolfEvent extends SportEventBase {
  tee_time: string | null;
  course_type: string | null;
  play_style: string | null;
}
export interface RunningEvent extends SportEventBase {
  course_id: string | null;
  target_pace: string | null;
}
export interface OutdoorEvent extends SportEventBase {
  spot_id: string | null;
  activity_type: string | null;
}
