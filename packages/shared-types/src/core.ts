import type { CategoryType, SkillLevel } from "./enums";

// ===== core スキーマ（種目横断の共通機能） =====

/** core.user_sports — 利用者が取り組む種目と自己申告レベル（種目横断の共通プロフィール）。 */
export interface UserSport {
  user_id: string;
  sport_id: string;
  skill_level: SkillLevel;
  experience_years: number | null;
  is_favorite: boolean;
}

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

export interface Report {
  id: string;
  reporter_id: string;
  domain: string; // 'golf' | 'running' | 'facility' | ...
  target_type: string;
  target_id: string;
  reason: string;
  detail: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  domain: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}
