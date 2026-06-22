-- =============================================================
-- 0023_premium_membership.sql
-- 収益化 Phase B: 利用者向けプレミアム会員（Stripe Billing, per-user）
--   - 無料会員: first_come（自由参加・承認不要）イベントのみ作成可。参加者条件は指定不可。
--   - プレミアム会員: 参加者条件（性別・スキル・趣味=種目・住所=都道府県）を指定でき、
--     承認制（approval）イベントを作成できる。参加には主催者の承認が必要。
--   - 決済顧客は account.billing_customers を Phase A と共用。課金額の真実源は Stripe。
--   - Stripe -> DB 同期は Webhook が唯一の真実源。書き込みはサービスロール、読み取りのみ RLS。
-- =============================================================

-- -------------------------------------------------------------
-- 1. プレミアム会員プラン定義（管理画面から編集可能, §15.10）
--    facility.subscription_plans とは別管理（対象が利用者単位のため account 配下）。
-- -------------------------------------------------------------
create table account.membership_plans (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,            -- 例: 'premium_member'
  name             text not null,
  description      text,
  stripe_price_id  text,                            -- Stripe Dashboard で作成した Price
  amount           int  not null default 0,         -- 表示用（円）。課金額の真実源は Stripe
  billing_interval text not null default 'month',    -- 'month' | 'year'（表示用）
  entitlements     jsonb not null default '{}'::jsonb,
  is_active        boolean not null default true,
  display_order    int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 2. 利用者単位のプレミアム会員サブスク（真実源は Stripe、ここは投影）
--    決済顧客 (stripe_customer_id) は account.billing_customers を参照。
-- -------------------------------------------------------------
create table account.user_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references account.users (id) on delete cascade,
  plan_id                uuid references account.membership_plans (id) on delete set null,
  stripe_subscription_id text unique,
  -- Stripe の subscription.status をそのまま保持:
  -- incomplete | trialing | active | past_due | canceled | unpaid
  status                 text not null default 'incomplete',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id)       -- 1 利用者につき有効サブスクは 1 本
);
create index user_subscriptions_status_idx on account.user_subscriptions (status);

-- -------------------------------------------------------------
-- 3. プレミアム判定ヘルパー（cross-schema, トリガー/RLS から利用）
-- -------------------------------------------------------------
create or replace function core.is_premium(uid uuid)
returns boolean language sql stable security definer set search_path = account, public as $$
  select exists (
    select 1 from account.user_subscriptions s
    where s.user_id = uid
      and s.status in ('active', 'trialing')
  );
$$;

-- -------------------------------------------------------------
-- 4. 各種目 events に参加者条件カラムを追加
--    性別 (gender_condition) / スキル (skill_level) は既存列を流用。
--    趣味=種目 (condition_sport_ids) / 住所=都道府県 (condition_prefectures) を新設。
-- -------------------------------------------------------------
alter table golf.events
  add column condition_prefectures text[] not null default '{}',
  add column condition_sport_ids   uuid[] not null default '{}';
alter table running.events
  add column condition_prefectures text[] not null default '{}',
  add column condition_sport_ids   uuid[] not null default '{}';
alter table outdoor.events
  add column condition_prefectures text[] not null default '{}',
  add column condition_sport_ids   uuid[] not null default '{}';

-- -------------------------------------------------------------
-- 5. プレミアム特典のサーバー側強制（多重防御）
--    非プレミアム主催者のイベントは条件をクリアし first_come に矯正する。
--    Server Action のガードと二重化（直接 INSERT/UPDATE でも条件を付与させない）。
-- -------------------------------------------------------------
create or replace function core.enforce_event_premium()
returns trigger language plpgsql security definer set search_path = account, core, public as $$
begin
  if not core.is_premium(new.organizer_id) then
    new.condition_prefectures := '{}';
    new.condition_sport_ids   := '{}';
    new.gender_condition      := 'unspecified';
    new.skill_level           := 'any';
    new.approval_type         := 'first_come';
  end if;
  return new;
end;
$$;

create trigger trg_golf_events_premium
  before insert or update on golf.events
  for each row execute function core.enforce_event_premium();
create trigger trg_running_events_premium
  before insert or update on running.events
  for each row execute function core.enforce_event_premium();
create trigger trg_outdoor_events_premium
  before insert or update on outdoor.events
  for each row execute function core.enforce_event_premium();

-- -------------------------------------------------------------
-- 6. RLS / 権限
--    読み取りのみポリシーで許可。書き込みはサービスロール（Webhook / 管理）に限定。
-- -------------------------------------------------------------
alter table account.membership_plans   enable row level security;
alter table account.user_subscriptions enable row level security;

-- 有効プランは全員 select 可（料金ページ）。管理は is_admin。
create policy membership_plans_public_select on account.membership_plans
  for select using (is_active = true or core.is_admin());
create policy membership_plans_admin_all on account.membership_plans
  for all using (core.is_admin()) with check (core.is_admin());

-- サブスク: 本人のみ select。書き込みポリシー無し -> Webhook（サービスロール）専用。
create policy user_subscriptions_self_select on account.user_subscriptions
  for select using (user_id = auth.uid() or core.is_admin());

-- 0009 の grant は当時のテーブルにのみ適用されるため、新規テーブルには明示的に付与する。
grant select on account.membership_plans   to anon, authenticated;
grant select on account.user_subscriptions to authenticated;

-- -------------------------------------------------------------
-- 7. プレミアム会員プランの初期投入（料金は表示用。stripe_price_id は後で設定）
-- -------------------------------------------------------------
insert into account.membership_plans (code, name, description, amount, billing_interval, entitlements, display_order)
values (
  'premium_member',
  'プレミアム会員',
  '参加者条件（性別・スキル・趣味・エリア）の指定と、承認制イベントの作成ができます。',
  1500,
  'month',
  '{"event_conditions": true, "approval_events": true}'::jsonb,
  1
)
-- 表示金額（amount）は再適用で更新する。stripe_price_id は手動設定値を保持（上書きしない）。
on conflict (code) do update
  set amount      = excluded.amount,
      name        = excluded.name,
      description = excluded.description;
