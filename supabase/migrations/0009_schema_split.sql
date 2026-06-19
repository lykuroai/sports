-- =============================================================
-- 0009 スキーマ分離：共通ユーザ基盤(account) / 種目横断共通(core) / 施設(facility)
-- 設計: docs/architecture/database_design.md
--
-- 方針:
--   * 実データが無い前提のクリーン再構築。0001-0008 で作った public.* の
--     ドメインテーブルは drop し、新スキーマで定義し直す。enum 型は public のまま再利用。
--   * 種目テーブル(golf/running/outdoor)は 0010 以降。本ファイルは account/core/facility。
--   * 共通 user_id = account.users.id。種目/施設は全てこれを FK 参照する。
--
-- ★運用注意: account / core / facility / golf 等のスキーマは Supabase の
--   「Exposed schemas」(Settings > API) に追加し、anon/authenticated に usage を
--   grant すること。本ファイル末尾で grant を行うが、PostgREST 公開設定は別途必要。
-- =============================================================

-- ---- 旧 public ドメインテーブルを破棄（データ無し前提）----
drop table if exists public.facility_subscriptions cascade;
drop table if exists public.billing_customers      cascade;
drop table if exists public.subscription_plans     cascade;
drop table if exists public.stripe_events          cascade;
drop table if exists public.audit_logs             cascade;
drop table if exists public.blocks                 cascade;
drop table if exists public.reports                cascade;
drop table if exists public.favorites              cascade;
drop table if exists public.facility_reviews       cascade;
drop table if exists public.user_reviews           cascade;
drop table if exists public.notifications          cascade;
drop table if exists public.chat_messages          cascade;
drop table if exists public.chat_room_members      cascade;
drop table if exists public.chat_rooms             cascade;
drop table if exists public.recruitment_participants cascade;
drop table if exists public.recruitments           cascade;
drop table if exists public.facility_owners        cascade;
drop table if exists public.facility_submissions   cascade;
drop table if exists public.facility_images        cascade;
drop table if exists public.facility_features      cascade;
drop table if exists public.facility_sports        cascade;
drop table if exists public.facilities             cascade;
drop table if exists public.user_sports            cascade;
drop table if exists public.profiles               cascade;
drop table if exists public.user_roles             cascade;
drop table if exists public.users                  cascade;

-- ---- スキーマ作成 ----
create schema if not exists account;
create schema if not exists core;
create schema if not exists facility;

-- =============================================================
-- account スキーマ（PII / 認証の唯一の保有者）
-- =============================================================
create table account.users (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text,
  phone                text,
  status               user_status not null default 'active',
  email_verified_at    timestamptz,
  phone_verified_at    timestamptz,
  identity_verified_at timestamptz,
  last_login_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create table account.user_roles (
  user_id uuid not null references account.users (id) on delete cascade,
  role    user_role not null,
  primary key (user_id, role)
);

-- 公開プロフィール（共通部のみ。種目固有項目は持たない）
create table account.profiles (
  user_id             uuid primary key references account.users (id) on delete cascade,
  nickname            text not null,
  avatar_url          text,
  introduction        text,
  gender              gender not null default 'unspecified',
  age_range           text,
  area                text,
  verification_status verification_status not null default 'unverified',
  rating              numeric(3, 2) not null default 0,
  participation_count int not null default 0,
  organizer_count     int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table account.notification_settings (
  user_id       uuid primary key references account.users (id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled  boolean not null default false,
  prefs         jsonb not null default '{}'::jsonb
);

create table account.terms_agreements (
  user_id       uuid not null references account.users (id) on delete cascade,
  terms_version text not null,
  agreed_at     timestamptz not null default now(),
  primary key (user_id, terms_version)
);

create table account.verifications (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references account.users (id) on delete cascade,
  type         text not null,
  status       verification_status not null default 'pending',
  evidence_url text,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- 決済顧客は共通ユーザ基盤の役割（依頼§共通ユーザ管理）
create table account.billing_customers (
  user_id            uuid primary key references account.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

-- =============================================================
-- core スキーマ（種目横断の共通機能）
-- =============================================================
create table core.sports (
  id            uuid primary key default uuid_generate_v4(),
  parent_id     uuid references core.sports (id) on delete set null,
  category_type category_type not null,
  name          text not null,
  slug          text not null unique,
  icon          text,
  display_order int not null default 0,
  status        sport_status not null default 'published',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table core.notifications (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references account.users (id) on delete cascade,
  notification_type text not null,
  title             text not null,
  body              text,
  related_type      text,
  related_id        text,
  read_at           timestamptz,
  created_at        timestamptz not null default now()
);
create index notifications_user_idx on core.notifications (user_id, created_at desc);

create table core.reports (
  id          uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references account.users (id) on delete cascade,
  domain      text not null,                  -- 'golf' | 'running' | 'facility' | ...
  target_type report_target not null,
  target_id   uuid not null,
  reason      text not null,
  detail      text,
  status      report_status not null default 'open',
  action      report_action not null default 'none',
  created_at  timestamptz not null default now()
);

create table core.blocks (
  blocker_id uuid not null references account.users (id) on delete cascade,
  blocked_id uuid not null references account.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table core.audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  actor_id    uuid references account.users (id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   text not null,
  domain      text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- =============================================================
-- facility スキーマ（種目横断の共有資産）
-- =============================================================
create table facility.facilities (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  facility_type text,
  description   text,
  postal_code   text,
  prefecture    text,
  city          text,
  address       text,
  latitude      double precision,
  longitude     double precision,
  geog          geography(Point, 4326),
  source        facility_source not null default 'admin',
  status        verification_status not null default 'verified',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index facilities_geog_idx on facility.facilities using gist (geog);
create index facilities_area_idx on facility.facilities (prefecture, city);

create table facility.facility_sports (
  facility_id uuid not null references facility.facilities (id) on delete cascade,
  sport_id    uuid not null references core.sports (id) on delete cascade,
  primary key (facility_id, sport_id)
);

create table facility.facility_features (
  facility_id uuid not null references facility.facilities (id) on delete cascade,
  feature_key text not null,
  value       text,
  primary key (facility_id, feature_key)
);

create table facility.facility_images (
  id          uuid primary key default uuid_generate_v4(),
  facility_id uuid not null references facility.facilities (id) on delete cascade,
  url         text not null,
  display_order int not null default 0
);

create table facility.facility_submissions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references account.users (id) on delete cascade,
  facility_id     uuid references facility.facilities (id) on delete set null,
  submission_type submission_type not null default 'new',
  submitted_data  jsonb not null,
  source_url      text,
  status          submission_status not null default 'pending',
  reviewed_by     uuid references account.users (id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create table facility.facility_owners (
  facility_id uuid not null references facility.facilities (id) on delete cascade,
  user_id     uuid not null references account.users (id) on delete cascade,
  status      owner_status not null default 'pending',
  verified_at timestamptz,
  primary key (facility_id, user_id)
);

create table facility.facility_reviews (
  id          uuid primary key default uuid_generate_v4(),
  facility_id uuid not null references facility.facilities (id) on delete cascade,
  user_id     uuid not null references account.users (id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (facility_id, user_id)
);

-- 施設運営者サブスク（収益化 Phase A）。決済顧客は account 側を参照。
create table facility.subscription_plans (
  id              uuid primary key default uuid_generate_v4(),
  code            text not null unique,
  name            text not null,
  description     text,
  stripe_price_id text,
  amount          int not null default 0,
  billing_interval text not null default 'month',
  entitlements    jsonb not null default '{}'::jsonb,
  is_active       boolean not null default true,
  display_order   int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table facility.facility_subscriptions (
  id                    uuid primary key default uuid_generate_v4(),
  facility_id           uuid not null references facility.facilities (id) on delete cascade,
  owner_user_id         uuid not null references account.users (id) on delete cascade,
  plan_id               uuid references facility.subscription_plans (id) on delete set null,
  stripe_subscription_id text unique,
  status                text not null default 'incomplete',
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table core.stripe_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

-- =============================================================
-- ヘルパー関数（cross-schema）
-- =============================================================
create or replace function core.is_admin()
returns boolean language sql stable security definer set search_path = account, public as $$
  select exists (
    select 1 from account.user_roles where user_id = auth.uid() and role = 'admin'
  );
$$;

-- 双方向ブロック判定（RLS から参照）
create or replace function core.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = core, public as $$
  select exists (
    select 1 from core.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- 現在地周辺検索（補助機能）。種目イベントは facility_id 経由で参照。
create or replace function facility.nearby_facilities(lat double precision, lng double precision, radius_m int, lim int)
returns setof facility.facilities language sql stable set search_path = facility, public as $$
  select * from facility.facilities
  where geog is not null
    and ST_DWithin(geog, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radius_m)
  order by ST_Distance(geog, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography)
  limit lim;
$$;

-- =============================================================
-- スキーマ usage の grant（PostgREST 公開は別途「Exposed schemas」設定が必要）
-- =============================================================
grant usage on schema account, core, facility to anon, authenticated, service_role;
grant all on all tables in schema account, core, facility to service_role;
grant select, insert, update, delete on all tables in schema account, core, facility to authenticated;
grant select on all tables in schema core, facility to anon;
alter default privileges in schema account, core, facility grant all on tables to service_role;
