import type { Gender, UserStatus } from "./enums";

// ===== account スキーマ（共通ユーザ基盤・PII / 認証） =====

/**
 * 外部ログイン（LINE 等）でメールが取得できなかった際にシステムが付与する合成メールの
 * ドメイン。これらは本物の連絡先ではないため、認証済み扱いにしない・表示しない・送信しない。
 */
export const PLACEHOLDER_EMAIL_DOMAINS = ["line.spotomo.local"] as const;

/** 合成（プレースホルダ）メールアドレスかどうか。実在しない内部用アドレスを判定する。 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && PLACEHOLDER_EMAIL_DOMAINS.includes(domain as (typeof PLACEHOLDER_EMAIL_DOMAINS)[number]);
}

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
