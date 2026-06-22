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

// 収益化 Phase A（施設運営者サブスク）は廃止＝施設運営者は無料。関連の型・DB オブジェクトは
// 削除済み（`0025_drop_facility_billing.sql`）。決済顧客 account.billing_customers と
// core.stripe_events はプレミアム会員(Phase B)と共用のため残置。
