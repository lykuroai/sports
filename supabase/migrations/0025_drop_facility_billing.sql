-- =============================================================
-- 0025_drop_facility_billing.sql
-- 方針変更: 施設運営者は無料（Phase A サブスク廃止）。
--   - facility の課金テーブルと RLS ポリシーを完全に削除する。
--   - 共用基盤（account.billing_customers / core.stripe_events）は
--     プレミアム会員(Phase B)が使うため残す。
--   - 施設の所有・編集は facility_owners(verified)＋RLS で無料提供のまま（影響なし）。
-- 注: promotion_rank/promoted_until は 0009 の schema split 時点で既に消滅済み
--     （旧 public.facilities ごと drop され、facility.facilities には引き継がれていない）。
-- =============================================================

-- RLS ポリシーはテーブル削除に伴い自動で消える。FK（facility_subscriptions→subscription_plans）
-- の順序に依存しないよう cascade で落とす。
drop table if exists facility.facility_subscriptions cascade;
drop table if exists facility.subscription_plans     cascade;
