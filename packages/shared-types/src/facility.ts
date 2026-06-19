// ===== facility スキーマ（種目横断の共有資産） =====

export interface Facility {
  id: string;
  name: string;
  facility_type: string | null;
  description: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface FacilitySubmission {
  id: string;
  user_id: string;
  facility_id: string | null;
  submission_type: "new" | "edit";
  submitted_data: Record<string, unknown>;
  source_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface FacilityOwner {
  facility_id: string;
  user_id: string;
  status: "pending" | "verified" | "revoked";
  verified_at: string | null;
}

export interface FacilityReview {
  id: string;
  facility_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

// ---- 収益化 Phase A: 施設運営者サブスク ----

export interface FacilityEntitlements {
  promotion_rank: number;
  max_images: number;
  analytics: boolean;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stripe_price_id: string | null;
  amount: number;
  billing_interval: "month" | "year";
  entitlements: FacilityEntitlements;
  is_active: boolean;
  display_order: number;
}

export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export interface FacilitySubscription {
  id: string;
  facility_id: string;
  owner_user_id: string;
  plan_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}
