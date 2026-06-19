-- =============================================================
-- 0010 account / core / facility の RLS
-- 原則（仕様 §11.1 / §15.3,§15.6,§15.9）:
--   * 連絡先(account.users.email/phone)は本人と管理者のみ。
--   * account.profiles は公開読み取り可、編集は本人のみ。
--   * core.notifications は本人のみ読取。INSERT ポリシーは設けない
--     （notifyUser() がサービスロールで作成）。
--   * facility は公開読み取り可、編集は admin / verified owner。
-- =============================================================

-- ---- account ----
alter table account.users                 enable row level security;
alter table account.user_roles            enable row level security;
alter table account.profiles              enable row level security;
alter table account.notification_settings enable row level security;
alter table account.terms_agreements      enable row level security;
alter table account.verifications         enable row level security;
alter table account.billing_customers     enable row level security;

create policy users_self_select on account.users
  for select using (id = auth.uid() or core.is_admin());
create policy users_self_update on account.users
  for update using (id = auth.uid());

create policy roles_self_select on account.user_roles
  for select using (user_id = auth.uid() or core.is_admin());

-- 公開プロフィール: 全員読取可・本人のみ編集
create policy profiles_public_select on account.profiles
  for select using (true);
create policy profiles_self_upsert on account.profiles
  for insert with check (user_id = auth.uid());
create policy profiles_self_update on account.profiles
  for update using (user_id = auth.uid());

create policy notif_settings_self on account.notification_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy terms_self on account.terms_agreements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy verifications_self on account.verifications
  for select using (user_id = auth.uid() or core.is_admin());
create policy verifications_self_insert on account.verifications
  for insert with check (user_id = auth.uid());
create policy billing_self on account.billing_customers
  for select using (user_id = auth.uid() or core.is_admin());

-- ---- core ----
alter table core.sports        enable row level security;
alter table core.notifications enable row level security;
alter table core.reports       enable row level security;
alter table core.blocks        enable row level security;
alter table core.audit_logs    enable row level security;

-- カテゴリは公開読取・管理者のみ編集
create policy sports_public_select on core.sports
  for select using (status = 'published' or core.is_admin());
create policy sports_admin_write on core.sports
  for all using (core.is_admin()) with check (core.is_admin());

-- 通知は本人のみ読取/既読更新。INSERT はサービスロール（ポリシー無し = 一般から不可）
create policy notif_self_select on core.notifications
  for select using (user_id = auth.uid());
create policy notif_self_update on core.notifications
  for update using (user_id = auth.uid());

-- 通報: 本人が作成、本人/管理者が読取
create policy reports_insert on core.reports
  for insert with check (reporter_id = auth.uid());
create policy reports_select on core.reports
  for select using (reporter_id = auth.uid() or core.is_admin());

-- ブロック: 本人のみ
create policy blocks_self on core.blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- 監査ログ: 管理者のみ読取（書込はサービスロール）
create policy audit_admin_select on core.audit_logs
  for select using (core.is_admin());

-- ---- facility ----
alter table facility.facilities             enable row level security;
alter table facility.facility_sports        enable row level security;
alter table facility.facility_features      enable row level security;
alter table facility.facility_images        enable row level security;
alter table facility.facility_submissions   enable row level security;
alter table facility.facility_owners        enable row level security;
alter table facility.facility_reviews       enable row level security;
alter table facility.subscription_plans     enable row level security;
alter table facility.facility_subscriptions enable row level security;

-- verified owner 判定
create or replace function facility.is_owner(fid uuid)
returns boolean language sql stable security definer set search_path = facility, public as $$
  select exists (
    select 1 from facility.facility_owners
    where facility_id = fid and user_id = auth.uid() and status = 'verified'
  );
$$;

create policy facilities_public_select on facility.facilities for select using (true);
create policy facilities_admin_write on facility.facilities
  for all using (core.is_admin() or facility.is_owner(id))
  with check (core.is_admin() or facility.is_owner(id));

create policy fac_sports_select on facility.facility_sports for select using (true);
create policy fac_sports_write on facility.facility_sports
  for all using (core.is_admin() or facility.is_owner(facility_id))
  with check (core.is_admin() or facility.is_owner(facility_id));

create policy fac_features_select on facility.facility_features for select using (true);
create policy fac_features_write on facility.facility_features
  for all using (core.is_admin() or facility.is_owner(facility_id))
  with check (core.is_admin() or facility.is_owner(facility_id));

create policy fac_images_select on facility.facility_images for select using (true);
create policy fac_images_write on facility.facility_images
  for all using (core.is_admin() or facility.is_owner(facility_id))
  with check (core.is_admin() or facility.is_owner(facility_id));

-- 施設申請: 本人が作成・読取、管理者が全件
create policy fac_sub_insert on facility.facility_submissions
  for insert with check (user_id = auth.uid());
create policy fac_sub_select on facility.facility_submissions
  for select using (user_id = auth.uid() or core.is_admin());

-- 施設オーナー: 本人・管理者が読取
create policy fac_owner_select on facility.facility_owners
  for select using (user_id = auth.uid() or core.is_admin());

-- レビュー: 公開読取・本人編集
create policy fac_review_select on facility.facility_reviews for select using (true);
create policy fac_review_write on facility.facility_reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- サブスク: プランは公開、購読は owner/admin
create policy plans_public_select on facility.subscription_plans
  for select using (is_active or core.is_admin());
create policy plans_admin_write on facility.subscription_plans
  for all using (core.is_admin()) with check (core.is_admin());
create policy subs_owner_select on facility.facility_subscriptions
  for select using (owner_user_id = auth.uid() or core.is_admin());
