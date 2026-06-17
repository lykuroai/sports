-- =============================================================
-- スポーツ・レジャー仲間募集／施設検索システム  初期スキーマ
-- 仕様書 §8 のデータベース基本設計に対応
-- =============================================================
-- 設計方針（CLAUDE.md / 仕様 §15）:
--   * users(非公開) と profiles(公開) を分離。連絡先は他利用者に公開しない。
--   * 施設位置は PostGIS geography で保持し距離検索に使う（補助機能）。
--   * 通報・ブロック・評価・操作ログは初期から用意。
--   * RLS を全テーブルで有効化。
-- =============================================================

create extension if not exists postgis;
create extension if not exists "uuid-ossp";

-- -------------------------------------------------------------
-- ENUM 型
-- -------------------------------------------------------------
create type user_status        as enum ('active', 'suspended', 'banned', 'withdrawn');
create type user_role          as enum ('user', 'facility_owner', 'admin');
create type category_type      as enum ('sports', 'outdoor');
create type sport_status       as enum ('published', 'unpublished');
create type skill_level        as enum ('beginner', 'intermediate', 'advanced', 'any');
create type gender             as enum ('male', 'female', 'other', 'unspecified');
create type indoor_outdoor     as enum ('indoor', 'outdoor', 'both');
create type facility_source    as enum ('opendata', 'partner_api', 'csv_import', 'user_submission', 'admin');
create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type submission_type    as enum ('new', 'correction');
create type submission_status  as enum ('pending', 'approved', 'rejected');
create type owner_status        as enum ('pending', 'verified', 'rejected', 'revoked');
create type approval_type       as enum ('approval', 'first_come', 'invite', 'lottery', 'instant');
create type visibility          as enum ('public', 'members', 'unlisted');
create type recruitment_status  as enum ('draft', 'open', 'few_left', 'full', 'waitlist', 'closed', 'finished', 'cancelled', 'private');
create type participant_status  as enum ('applied', 'approved', 'rejected', 'waitlist', 'cancelled_self', 'cancelled_organizer', 'attended', 'absent', 'no_show');
create type attendance_status   as enum ('unknown', 'present', 'absent');
create type chat_room_status    as enum ('active', 'closed');
create type chat_member_role    as enum ('organizer', 'participant');
create type message_type        as enum ('text', 'image', 'location', 'announcement', 'system');
create type review_visibility   as enum ('public', 'restricted');
create type favorite_target     as enum ('recruitment', 'facility', 'sport', 'area', 'organizer');
create type report_target       as enum ('recruitment', 'user', 'message', 'facility', 'review');
create type report_status       as enum ('open', 'reviewing', 'actioned', 'dismissed');
create type report_action       as enum ('none', 'warned', 'hidden', 'recruitment_stopped', 'chat_restricted', 'suspended', 'banned');

-- =============================================================
-- 8.1 users  / 権限テーブル
-- =============================================================
-- auth.users(Supabase Auth) を親とする公開/非公開分離。
create table public.users (
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

-- 権限分離（管理者/施設運営者）。RLS から参照する。
create table public.user_roles (
  user_id uuid not null references public.users (id) on delete cascade,
  role    user_role not null,
  primary key (user_id, role)
);

-- =============================================================
-- 8.2 profiles （公開プロフィール。連絡先は含めない）
-- =============================================================
create table public.profiles (
  user_id            uuid primary key references public.users (id) on delete cascade,
  display_name       text not null,
  avatar_url         text,
  introduction       text,
  gender             gender not null default 'unspecified',
  birth_year         int,
  prefecture         text,
  city               text,
  activity_area      text,
  activity_days      text[],
  activity_time_slots text[],
  rating             numeric(3, 2) not null default 0,
  participation_count int not null default 0,
  organizer_count    int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- =============================================================
-- 8.3 sports （カテゴリーツリー。管理者が管理）
-- =============================================================
create table public.sports (
  id            uuid primary key default uuid_generate_v4(),
  parent_id     uuid references public.sports (id) on delete set null,
  category_type category_type not null,
  name          text not null,
  slug          text not null unique,
  icon          text,
  display_order int not null default 0,
  status        sport_status not null default 'published',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 8.4 user_sports
create table public.user_sports (
  user_id          uuid not null references public.users (id) on delete cascade,
  sport_id         uuid not null references public.sports (id) on delete cascade,
  skill_level      skill_level not null default 'beginner',
  experience_years int,
  is_favorite      boolean not null default false,
  primary key (user_id, sport_id)
);

-- =============================================================
-- 8.5 facilities （PostGIS で位置を保持）
-- =============================================================
create table public.facilities (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  facility_type       text,
  description         text,
  postal_code         text,
  prefecture          text,
  city                text,
  address             text,
  latitude            double precision,
  longitude           double precision,
  geom                geography(Point, 4326),
  nearest_station     text,
  access_description  text,
  phone               text,
  website_url         text,
  reservation_url     text,
  opening_hours       jsonb,
  holiday_description text,
  price_description   text,
  indoor_outdoor_type indoor_outdoor,
  source_type         facility_source not null default 'admin',
  source_id           text,
  verification_status verification_status not null default 'unverified',
  verified_at         timestamptz,
  last_confirmed_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index facilities_geom_idx on public.facilities using gist (geom);
create index facilities_pref_city_idx on public.facilities (prefecture, city);

-- 緯度経度から geom を自動生成
create or replace function public.sync_facility_geom()
returns trigger language plpgsql as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.geom := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  else
    new.geom := null;
  end if;
  return new;
end;
$$;
create trigger trg_facilities_geom
  before insert or update of latitude, longitude on public.facilities
  for each row execute function public.sync_facility_geom();

-- 8.6 facility_sports
create table public.facility_sports (
  facility_id uuid not null references public.facilities (id) on delete cascade,
  sport_id    uuid not null references public.sports (id) on delete cascade,
  notes       text,
  primary key (facility_id, sport_id)
);

-- 8.7 facility_features
create table public.facility_features (
  id            uuid primary key default uuid_generate_v4(),
  facility_id   uuid not null references public.facilities (id) on delete cascade,
  feature_type  text not null,
  feature_value text
);

-- 8.8 facility_images
create table public.facility_images (
  id            uuid primary key default uuid_generate_v4(),
  facility_id   uuid not null references public.facilities (id) on delete cascade,
  image_url     text not null,
  uploaded_by   uuid references public.users (id) on delete set null,
  display_order int not null default 0,
  status        text not null default 'pending',
  created_at    timestamptz not null default now()
);

-- 8.9 facility_submissions （新規登録/修正申請）
create table public.facility_submissions (
  id               uuid primary key default uuid_generate_v4(),
  facility_id      uuid references public.facilities (id) on delete set null,
  submitted_by     uuid not null references public.users (id) on delete cascade,
  submission_type  submission_type not null,
  submitted_data   jsonb not null,
  evidence_url     text,
  comment          text,
  status           submission_status not null default 'pending',
  reviewed_by      uuid references public.users (id) on delete set null,
  reviewed_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz not null default now()
);

-- 8.10 facility_owners
create table public.facility_owners (
  facility_id         uuid not null references public.facilities (id) on delete cascade,
  user_id             uuid not null references public.users (id) on delete cascade,
  status              owner_status not null default 'pending',
  verification_method text,
  verified_by         uuid references public.users (id) on delete set null,
  verified_at         timestamptz,
  primary key (facility_id, user_id)
);

-- =============================================================
-- 8.11 recruitments （中心エンティティ。施設未定を許容）
-- =============================================================
create table public.recruitments (
  id                  uuid primary key default uuid_generate_v4(),
  organizer_id        uuid not null references public.users (id) on delete cascade,
  sport_id            uuid not null references public.sports (id),
  facility_id         uuid references public.facilities (id) on delete set null,
  title               text not null,
  description         text,
  image_url           text,
  prefecture          text,
  city                text,
  location_description text,
  meeting_place       text,
  event_start_at      timestamptz not null,
  event_end_at        timestamptz,
  meeting_at          timestamptz,
  application_deadline timestamptz,
  capacity            int not null default 1,
  participation_fee   int not null default 0,
  payment_method      text,
  target_age_min      int,
  target_age_max      int,
  gender_condition    gender not null default 'unspecified',
  skill_level         skill_level not null default 'any',
  beginner_allowed    boolean not null default true,
  approval_type       approval_type not null default 'approval',
  visibility          visibility not null default 'public',
  rain_policy         text,
  cancellation_policy text,
  status              recruitment_status not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index recruitments_search_idx on public.recruitments (status, event_start_at);
create index recruitments_sport_idx on public.recruitments (sport_id);
create index recruitments_area_idx on public.recruitments (prefecture, city);

-- 8.12 recruitment_participants
create table public.recruitment_participants (
  recruitment_id      uuid not null references public.recruitments (id) on delete cascade,
  user_id             uuid not null references public.users (id) on delete cascade,
  status              participant_status not null default 'applied',
  application_message text,
  skill_level         skill_level,
  equipment_status    text,
  organizer_note      text,
  applied_at          timestamptz not null default now(),
  approved_at         timestamptz,
  cancelled_at        timestamptz,
  attendance_status   attendance_status not null default 'unknown',
  updated_at          timestamptz not null default now(),
  primary key (recruitment_id, user_id)
);

-- =============================================================
-- 8.13-8.15 チャット（募集ごとのグループチャット）
-- =============================================================
create table public.chat_rooms (
  id             uuid primary key default uuid_generate_v4(),
  recruitment_id uuid not null unique references public.recruitments (id) on delete cascade,
  status         chat_room_status not null default 'active',
  created_at     timestamptz not null default now()
);

create table public.chat_room_members (
  chat_room_id uuid not null references public.chat_rooms (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  left_at      timestamptz,
  role         chat_member_role not null default 'participant',
  primary key (chat_room_id, user_id)
);

create table public.chat_messages (
  id           uuid primary key default uuid_generate_v4(),
  chat_room_id uuid not null references public.chat_rooms (id) on delete cascade,
  sender_id    uuid references public.users (id) on delete set null,
  message_type message_type not null default 'text',
  message      text,
  image_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index chat_messages_room_idx on public.chat_messages (chat_room_id, created_at);

-- =============================================================
-- 8.16 notifications
-- =============================================================
create table public.notifications (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.users (id) on delete cascade,
  notification_type text not null,
  title             text not null,
  body              text,
  related_type      text,
  related_id        uuid,
  read_at           timestamptz,
  created_at        timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- =============================================================
-- 8.17-8.18 評価
-- =============================================================
create table public.user_reviews (
  id             uuid primary key default uuid_generate_v4(),
  reviewer_id    uuid not null references public.users (id) on delete cascade,
  target_user_id uuid not null references public.users (id) on delete cascade,
  recruitment_id uuid not null references public.recruitments (id) on delete cascade,
  rating         int not null check (rating between 1 and 5),
  review_tags    text[],
  comment        text,
  visibility     review_visibility not null default 'restricted',
  created_at     timestamptz not null default now(),
  unique (reviewer_id, target_user_id, recruitment_id)
);

create table public.facility_reviews (
  id                uuid primary key default uuid_generate_v4(),
  facility_id       uuid not null references public.facilities (id) on delete cascade,
  user_id           uuid not null references public.users (id) on delete cascade,
  recruitment_id    uuid references public.recruitments (id) on delete set null,
  rating            int not null check (rating between 1 and 5),
  equipment_rating  int,
  cleanliness_rating int,
  access_rating     int,
  price_rating      int,
  comment           text,
  status            text not null default 'published',
  created_at        timestamptz not null default now()
);

-- =============================================================
-- 8.19 favorites / 8.20 reports / 8.21 blocks
-- =============================================================
create table public.favorites (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users (id) on delete cascade,
  target_type favorite_target not null,
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create table public.reports (
  id          uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.users (id) on delete cascade,
  target_type report_target not null,
  target_id   uuid not null,
  reason      text not null,
  description text,
  evidence_url text,
  status      report_status not null default 'open',
  handled_by  uuid references public.users (id) on delete set null,
  handled_at  timestamptz,
  action_type report_action not null default 'none',
  created_at  timestamptz not null default now()
);

create table public.blocks (
  blocker_user_id uuid not null references public.users (id) on delete cascade,
  blocked_user_id uuid not null references public.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id)
);

-- 操作ログ（仕様 §11.1 / §15.9）
create table public.audit_logs (
  id         uuid primary key default uuid_generate_v4(),
  actor_id   uuid references public.users (id) on delete set null,
  action     text not null,
  target_type text,
  target_id  uuid,
  detail     jsonb,
  created_at timestamptz not null default now()
);

-- =============================================================
-- 共通: updated_at 自動更新
-- =============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'users','profiles','sports','facilities','recruitments',
    'recruitment_participants','chat_messages'
  ] loop
    execute format(
      'create trigger trg_%1$s_touch before update on public.%1$s
         for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- =============================================================
-- 新規 auth.users から public.users + profiles を自動生成
-- =============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.profiles (user_id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
    on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
