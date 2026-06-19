import type { Gender, UserStatus } from "./enums";

// ===== account スキーマ（共通ユーザ基盤・PII / 認証） =====

/** account.users — 非公開の認証データ。他利用者に公開しない。 */
export interface AppUser {
  id: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  identity_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** account.profiles — 公開プロフィール（共通部のみ。種目固有項目は持たない）。 */
export interface Profile {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  introduction: string | null;
  gender: Gender;
  age_range: string | null;
  area: string | null;
  verification_status: string | null;
  rating: number;
  participation_count: number;
  organizer_count: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  prefs: Record<string, boolean>;
}

export interface TermsAgreement {
  user_id: string;
  terms_version: string;
  agreed_at: string;
}

export interface BillingCustomer {
  user_id: string;
  stripe_customer_id: string;
  created_at: string;
}
