// Supabase スキーマの型定義。
// 本番では `supabase gen types typescript` で自動生成して置き換える想定。
// ここでは MVP で使うテーブルを手書きで定義する。

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "any";
export type Gender = "male" | "female" | "other" | "unspecified";
export type ApprovalType = "approval" | "first_come" | "invite" | "lottery" | "instant";
export type Visibility = "public" | "members" | "unlisted";
export type RecruitmentStatus =
  | "draft"
  | "open"
  | "few_left"
  | "full"
  | "waitlist"
  | "closed"
  | "finished"
  | "cancelled"
  | "private";
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
export type CategoryType = "sports" | "outdoor";

export interface Sport {
  id: string;
  parent_id: string | null;
  category_type: CategoryType;
  name: string;
  slug: string;
  icon: string | null;
  display_order: number;
  status: "published" | "unpublished";
}

export interface Profile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  introduction: string | null;
  gender: Gender;
  birth_year: number | null;
  prefecture: string | null;
  city: string | null;
  activity_area: string | null;
  activity_days: string[] | null;
  activity_time_slots: string[] | null;
  rating: number;
  participation_count: number;
  organizer_count: number;
}

export interface Recruitment {
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
  status: RecruitmentStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RecruitmentParticipant {
  recruitment_id: string;
  user_id: string;
  status: ParticipantStatus;
  application_message: string | null;
  skill_level: SkillLevel | null;
  equipment_status: string | null;
  organizer_note: string | null;
  applied_at: string;
  approved_at: string | null;
  cancelled_at: string | null;
  attendance_status: "unknown" | "present" | "absent";
}

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

interface TableDef<T> {
  Row: Row<T>;
  Insert: Insert<T>;
  Update: Update<T>;
  Relationships: [];
}

export interface ChatRoom {
  id: string;
  recruitment_id: string;
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

export interface Notification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string | null;
  related_type: string | null;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AppUser {
  id: string;
  email: string | null;
  status: "active" | "suspended" | "banned" | "withdrawn";
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      users: TableDef<AppUser>;
      sports: TableDef<Sport>;
      profiles: TableDef<Profile>;
      recruitments: TableDef<Recruitment>;
      recruitment_participants: TableDef<RecruitmentParticipant>;
      chat_rooms: TableDef<ChatRoom>;
      chat_room_members: TableDef<ChatRoomMember>;
      chat_messages: TableDef<ChatMessage>;
      notifications: TableDef<Notification>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
