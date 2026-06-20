-- =============================================================
-- 0008_billing.sql
-- 収益化 Phase A: 施設運営者向け有料プラン（Stripe Billing）
--   - 1 施設 = 有効サブスク 1 本（per-facility）
--   - プラン定義は管理画面から編集可能（§15.10）。課金額の真実源は Stripe
--   - Stripe -> DB 同期は Webhook が唯一の真実源
--   - 他者/特権データの書き込みはサービスロール、読み取りのみ RLS（本リポジトリの原則）
-- 設計詳細: docs/monetization/phase-a-facility-owner-billing.md
-- =============================================================

-- -------------------------------------------------------------
-- 1. プラン定義（管理画面から編集可能）
-- -------------------------------------------------------------
create table public.subscription_plans (
  id              uuid primary key default uuid_generate_v4(),
  code            text not null unique,           -- 例: 'facility_basic'
  name            text not null,
  description     text,
  stripe_price_id text,                            -- Stripe Dashboard で作成した Price
  amount           int  not null default 0,        -- 表示用（円）。課金額の真実源は Stripe
  billing_interval text not null default 'month',   -- 'month' | 'year'（表示用。interval は予約語のため改名）
  entitlements    jsonb not null default '{}'::jsonb,
                  -- 例: {"promotion_rank":10,"max_images":10,"analytics":true}
  is_active       boolean not null default true,
  display_order   int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 2. user <-> Stripe Customer（Phase B のプレミアム会員でも共用）
-- -------------------------------------------------------------
create table public.billing_customers (
  user_id            uuid primary key references public.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 3. 施設単位のサブスク（真実源は Stripe、ここは投影）
-- -------------------------------------------------------------
create table public.facility_subscriptions (
  id                     uuid primary key default uuid_generate_v4(),
  facility_id            uuid not null references public.facilities (id) on delete cascade,
  owner_user_id          uuid not null references public.users (id) on delete cascade,
  plan_id                uuid references public.subscription_plans (id),
  stripe_subscription_id text unique,
  -- Stripe の subscription.status をそのまま保持:
  -- incomplete | trialing | active | past_due | canceled | unpaid
  status                 text not null default 'incomplete',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (facility_id)   -- 1 施設につき有効サブスクは 1 本
);
create index facility_subscriptions_status_idx
  on public.facility_subscriptions (status);
create index facility_subscriptions_owner_idx
  on public.facility_subscriptions (owner_user_id);

-- -------------------------------------------------------------
-- 4. Webhook 冪等化（Connect イベントでも共用）
-- -------------------------------------------------------------
create table public.stripe_events (
  id          text primary key,    -- Stripe event.id（evt_...）
  type        text not null,
  received_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 5. facilities への非正規化カラム（検索並び替え・読み取り高速化）
--    更新は Webhook のみが行う
-- -------------------------------------------------------------
alter table public.facilities
  add column promotion_rank int not null default 0,   -- 高いほど上位
  add column promoted_until timestamptz;              -- これを過ぎたら昇格失効
create index facilities_promotion_idx
  on public.facilities (promotion_rank desc, promoted_until);

-- 昇格カラムの更新は Webhook（サービスロール）のみ。verified オーナーに対する
-- 既存の facilities_owner_update ポリシーは行内の全カラム UPDATE を許すため、
-- 当該カラムだけはカラム単位で UPDATE 権限を剥奪し、自己昇格を防ぐ。
-- サービスロールは RLS とカラム権限の双方をバイパスするため Webhook は通る。
revoke update (promotion_rank, promoted_until)
  on public.facilities from anon, authenticated;

-- -------------------------------------------------------------
-- 6. updated_at 自動更新トリガー（既存の流儀に合わせる）
-- -------------------------------------------------------------
create trigger trg_subscription_plans_touch
  before update on public.subscription_plans
  for each row execute function public.touch_updated_at();
create trigger trg_facility_subscriptions_touch
  before update on public.facility_subscriptions
  for each row execute function public.touch_updated_at();

-- =============================================================
-- RLS
--   読み取りのみポリシーで許可。書き込みはサービスロール（Webhook / 管理）に限定。
-- =============================================================
alter table public.subscription_plans      enable row level security;
alter table public.billing_customers       enable row level security;
alter table public.facility_subscriptions  enable row level security;
alter table public.stripe_events           enable row level security;

-- 6.1 プラン: 有効プランは全員 select 可（料金ページ）。管理は is_admin。
create policy subscription_plans_public_select on public.subscription_plans
  for select using (is_active = true or public.is_admin());
create policy subscription_plans_admin_all on public.subscription_plans
  for all using (public.is_admin()) with check (public.is_admin());

-- 6.2 Customer: 本人のみ select。書き込みポリシー無し -> サービスロール専用。
create policy billing_customers_self_select on public.billing_customers
  for select using (user_id = auth.uid() or public.is_admin());

-- 6.3 サブスク: 当該施設の verified オーナー（または管理者）のみ select。
--     書き込みポリシー無し -> Webhook / Server Action がサービスロールで実行。
create policy facility_subscriptions_owner_select on public.facility_subscriptions
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.facility_owners o
      where o.facility_id = facility_subscriptions.facility_id
        and o.user_id = auth.uid()
        and o.status = 'verified'
    )
  );

-- 6.4 stripe_events: ポリシー無し（サービスロール専用。is_admin の読みは許可）。
create policy stripe_events_admin_select on public.stripe_events
  for select using (public.is_admin());
