// ===== golf スキーマ：楽天GORA 連携（0020_golf_gora.sql / rakuten_gora_reservation_spec.md） =====

/** 楽天GORA ゴルフ場の永続記録。 */
export interface GolfCourse {
  id: string;
  facility_id: string | null;
  rakuten_gora_course_id: string;
  golf_course_name: string;
  area_code: string | null;
  prefecture: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  golf_course_url: string | null;
  rating: number | null;
  source_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 募集に紐づく楽天GORA プランのスナップショット。 */
export interface GolfPlan {
  id: string;
  event_id: string | null;
  rakuten_gora_course_id: string | null;
  rakuten_gora_plan_id: string | null;
  play_date: string | null;
  start_time_zone: string | null;
  plan_name: string | null;
  price: number | null;
  min_players: number | null;
  max_players: number | null;
  lunch_included: boolean | null;
  caddie_included: boolean | null;
  cart_type: string | null;
  two_sum_guaranteed: boolean | null;
  three_b_extra_fee: number | null;
  four_b_price: number | null;
  cancel_fee_flag: boolean | null;
  cancel_fee_description: string | null;
  reserve_url: string | null;
  fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 予約状態（楽天GORA側の確定を主催者が手動反映。仕様 §8）。 */
export type GolfReservationStatus =
  | "not_reserved"
  | "planning"
  | "reserved_external"
  | "changed_external"
  | "cancelled_external"
  | "unknown";

export const GOLF_RESERVATION_STATUS_LABEL: Record<GolfReservationStatus, string> = {
  not_reserved: "未予約",
  planning: "募集中",
  reserved_external: "楽天GORAで予約済み",
  changed_external: "楽天GORAで変更済み",
  cancelled_external: "楽天GORAでキャンセル済み",
  unknown: "未確認",
};

/** 募集とゴルフ予約情報の関連。 */
export interface EventGolfDetails {
  event_id: string;
  golf_course_id: string | null;
  golf_plan_id: string | null;
  reservation_status: GolfReservationStatus;
  external_reservation_note: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}
