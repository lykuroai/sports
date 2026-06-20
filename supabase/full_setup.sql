-- =============================================================
-- リセット前文：既存スキーマを破棄してから全マイグレーションを流す。
-- 「既存projectをリセット」方針用。新規projectでも安全（drop if exists）。
-- ※ auth/storage 等 Supabase 管理スキーマには触れない（public とアプリ用スキーマのみ）。
-- =============================================================
drop schema if exists golf cascade;
drop schema if exists running cascade;
drop schema if exists outdoor cascade;
drop schema if exists facility cascade;
drop schema if exists core cascade;
drop schema if exists account cascade;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
-- 以降は migrations 0001〜0015 + seed をそのまま結合（このファイルは自動生成）。

-- >>>>>>>>>>>>>>>>>> 0001_init.sql >>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>> 0002_rls.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- Row Level Security ポリシー
-- 仕様 §11.1 / §15.3,§15.6,§15.9
--   * 連絡先(users.email/phone)は本人と管理者のみ。
--   * profiles は公開読み取り可、編集は本人のみ。
--   * 募集は公開状態のみ一般公開、下書き/非公開は主催者のみ。
--   * チャットは承認済みメンバーのみ。
-- =============================================================

-- ヘルパー: 現在ユーザーが管理者か
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ヘルパー: 募集のメンバー（主催者 or 承認済み参加者）か
create or replace function public.is_recruitment_member(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.recruitments r where r.id = rid and r.organizer_id = auth.uid())
      or exists (
        select 1 from public.recruitment_participants p
        where p.recruitment_id = rid and p.user_id = auth.uid() and p.status = 'approved'
      );
$$;

-- RLS 有効化
alter table public.users                  enable row level security;
alter table public.user_roles             enable row level security;
alter table public.profiles               enable row level security;
alter table public.sports                 enable row level security;
alter table public.user_sports            enable row level security;
alter table public.facilities             enable row level security;
alter table public.facility_sports        enable row level security;
alter table public.facility_features      enable row level security;
alter table public.facility_images        enable row level security;
alter table public.facility_submissions   enable row level security;
alter table public.facility_owners        enable row level security;
alter table public.recruitments           enable row level security;
alter table public.recruitment_participants enable row level security;
alter table public.chat_rooms             enable row level security;
alter table public.chat_room_members      enable row level security;
alter table public.chat_messages          enable row level security;
alter table public.notifications          enable row level security;
alter table public.user_reviews           enable row level security;
alter table public.facility_reviews       enable row level security;
alter table public.favorites              enable row level security;
alter table public.reports                enable row level security;
alter table public.blocks                 enable row level security;
alter table public.audit_logs             enable row level security;

-- ---------- users（連絡先は本人/管理者のみ） ----------
create policy users_self_select on public.users
  for select using (id = auth.uid() or public.is_admin());
create policy users_self_update on public.users
  for update using (id = auth.uid());

-- ---------- user_roles ----------
create policy roles_self_select on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());
create policy roles_admin_all on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- profiles（公開） ----------
create policy profiles_public_select on public.profiles
  for select using (true);
create policy profiles_self_modify on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profiles_self_insert on public.profiles
  for insert with check (user_id = auth.uid());

-- ---------- sports（公開読み取り / 編集は管理者） ----------
create policy sports_public_select on public.sports
  for select using (status = 'published' or public.is_admin());
create policy sports_admin_write on public.sports
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- user_sports（本人のみ） ----------
create policy user_sports_select on public.user_sports
  for select using (true);
create policy user_sports_modify on public.user_sports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- facilities（公開読み取り / 編集は管理者・運営者） ----------
create policy facilities_public_select on public.facilities
  for select using (deleted_at is null or public.is_admin());
create policy facilities_admin_write on public.facilities
  for all using (public.is_admin()) with check (public.is_admin());
create policy facilities_owner_update on public.facilities
  for update using (
    exists (select 1 from public.facility_owners o
            where o.facility_id = id and o.user_id = auth.uid() and o.status = 'verified')
  );

create policy facility_sports_select on public.facility_sports for select using (true);
create policy facility_features_select on public.facility_features for select using (true);
create policy facility_images_select on public.facility_images
  for select using (status = 'published' or public.is_admin());

-- ---------- facility_submissions（申請者本人 + 管理者） ----------
create policy submissions_insert on public.facility_submissions
  for insert with check (submitted_by = auth.uid());
create policy submissions_select on public.facility_submissions
  for select using (submitted_by = auth.uid() or public.is_admin());
create policy submissions_admin_update on public.facility_submissions
  for update using (public.is_admin()) with check (public.is_admin());

create policy facility_owners_select on public.facility_owners
  for select using (user_id = auth.uid() or public.is_admin());
create policy facility_owners_insert on public.facility_owners
  for insert with check (user_id = auth.uid());

-- ---------- recruitments ----------
-- 公開状態のものは誰でも閲覧。下書き/非公開は主催者と管理者のみ。
create policy recruitments_public_select on public.recruitments
  for select using (
    (visibility = 'public' and status not in ('draft', 'private') and deleted_at is null)
    or organizer_id = auth.uid()
    or public.is_admin()
  );
create policy recruitments_owner_insert on public.recruitments
  for insert with check (organizer_id = auth.uid());
create policy recruitments_owner_update on public.recruitments
  for update using (organizer_id = auth.uid() or public.is_admin());
create policy recruitments_owner_delete on public.recruitments
  for delete using (organizer_id = auth.uid() or public.is_admin());

-- ---------- recruitment_participants ----------
-- 本人・主催者・管理者が閲覧可。申請は本人、承認操作は主催者。
create policy participants_select on public.recruitment_participants
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.recruitments r where r.id = recruitment_id and r.organizer_id = auth.uid())
    or public.is_admin()
  );
create policy participants_apply on public.recruitment_participants
  for insert with check (user_id = auth.uid());
-- 本人キャンセル or 主催者による承認/拒否
create policy participants_update on public.recruitment_participants
  for update using (
    user_id = auth.uid()
    or exists (select 1 from public.recruitments r where r.id = recruitment_id and r.organizer_id = auth.uid())
    or public.is_admin()
  );

-- ---------- chat（承認済みメンバーのみ） ----------
create policy chat_rooms_select on public.chat_rooms
  for select using (public.is_recruitment_member(recruitment_id) or public.is_admin());
create policy chat_members_select on public.chat_room_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.chat_rooms c where c.id = chat_room_id and public.is_recruitment_member(c.recruitment_id))
  );
create policy chat_messages_select on public.chat_messages
  for select using (
    exists (select 1 from public.chat_rooms c where c.id = chat_room_id and public.is_recruitment_member(c.recruitment_id))
  );
create policy chat_messages_insert on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.chat_rooms c where c.id = chat_room_id and public.is_recruitment_member(c.recruitment_id))
  );
create policy chat_messages_update on public.chat_messages
  for update using (sender_id = auth.uid() or public.is_admin());

-- ---------- notifications（本人のみ） ----------
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());

-- ---------- reviews ----------
-- user_reviews: 公開分は誰でも、制限分は当事者と管理者のみ。
create policy user_reviews_select on public.user_reviews
  for select using (
    visibility = 'public'
    or reviewer_id = auth.uid() or target_user_id = auth.uid()
    or public.is_admin()
  );
create policy user_reviews_insert on public.user_reviews
  for insert with check (reviewer_id = auth.uid());

create policy facility_reviews_select on public.facility_reviews
  for select using (status = 'published' or user_id = auth.uid() or public.is_admin());
create policy facility_reviews_insert on public.facility_reviews
  for insert with check (user_id = auth.uid());

-- ---------- favorites / blocks（本人のみ） ----------
create policy favorites_all on public.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy blocks_all on public.blocks
  for all using (blocker_user_id = auth.uid()) with check (blocker_user_id = auth.uid());

-- ---------- reports（申請は本人、閲覧は本人/管理者） ----------
create policy reports_insert on public.reports
  for insert with check (reporter_id = auth.uid());
create policy reports_select on public.reports
  for select using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin_update on public.reports
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- audit_logs（管理者のみ） ----------
create policy audit_admin_select on public.audit_logs
  for select using (public.is_admin());

-- >>>>>>>>>>>>>>>>>> 0003_reviews.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- 評価・レビューの集計（仕様 §6.10）
--   * user_reviews 登録時に対象ユーザーの総合評価を再計算
--   * 募集が「開催済み(finished)」になった時に主催回数・参加回数を再計算
-- いずれも RLS を跨いで他ユーザーの profiles を更新するため
-- SECURITY DEFINER とする。
-- =============================================================

-- 対象ユーザーの総合評価を全レビューの平均で更新
create or replace function public.recompute_user_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.target_user_id, old.target_user_id);
begin
  update public.profiles p
     set rating = coalesce((
       select round(avg(r.rating)::numeric, 2)
         from public.user_reviews r
        where r.target_user_id = target
     ), 0)
   where p.user_id = target;
  return null;
end;
$$;

create trigger trg_user_reviews_rating
  after insert or update or delete on public.user_reviews
  for each row execute function public.recompute_user_rating();

-- 募集が開催済みになったら、主催者の主催回数と承認済み参加者の参加回数を再計算
create or replace function public.recompute_event_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'finished' and (old.status is distinct from 'finished') then
    -- 主催回数
    update public.profiles p
       set organizer_count = (
         select count(*) from public.recruitments r
          where r.organizer_id = new.organizer_id and r.status = 'finished'
       )
     where p.user_id = new.organizer_id;

    -- 当該募集の承認済み参加者の参加回数
    update public.profiles p
       set participation_count = (
         select count(distinct rp.recruitment_id)
           from public.recruitment_participants rp
           join public.recruitments r on r.id = rp.recruitment_id
          where rp.user_id = p.user_id
            and rp.status in ('approved', 'attended')
            and r.status = 'finished'
       )
     where p.user_id in (
       select user_id from public.recruitment_participants
        where recruitment_id = new.id and status in ('approved', 'attended')
     );
  end if;
  return null;
end;
$$;

create trigger trg_recruitment_counts
  after update of status on public.recruitments
  for each row execute function public.recompute_event_counts();

-- >>>>>>>>>>>>>>>>>> 0004_admin.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- 管理者向けポリシー（仕様 §7.4 / §11.1）
-- アプリの管理操作は基本的にサービスロール経由で行うが、
-- セッションクライアントから管理者が操作する場合に備えて
-- 防御的に admin の更新ポリシーを追加する。
-- =============================================================

-- 管理者は利用者アカウントの状態（停止/復帰）を更新できる
create policy users_admin_update on public.users
  for update using (public.is_admin()) with check (public.is_admin());

-- 管理者はプロフィールを更新できる（なりすまし対応・不適切情報の修正）
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- 管理者は施設レビューを更新できる（非公開化）
create policy facility_reviews_admin_update on public.facility_reviews
  for update using (public.is_admin()) with check (public.is_admin());

-- 管理者は監査ログを記録できる
create policy audit_admin_insert on public.audit_logs
  for insert with check (public.is_admin());

-- =============================================================
-- 管理者の付与（手動）:
--   insert into public.user_roles (user_id, role)
--   values ('<auth.users.id>', 'admin');
-- =============================================================

-- >>>>>>>>>>>>>>>>>> 0005_blocks.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- ブロック判定（仕様 §6.11）
-- RLS では自分が作成したブロック行しか読めないため、双方向の
-- ブロック有無を判定する SECURITY DEFINER 関数を用意する。
-- =============================================================
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
     where (blocker_user_id = a and blocked_user_id = b)
        or (blocker_user_id = b and blocked_user_id = a)
  );
$$;

-- >>>>>>>>>>>>>>>>>> 0006_geo.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- 現在地周辺の施設検索（仕様 §6.5 / §9.4）
-- 補助機能としての近傍検索。地点(lat,lng)から半径 radius_m 内の
-- 施設を距離順に返す。PostGIS の geography 距離を使用。
-- =============================================================
create or replace function public.nearby_facilities(
  lat double precision,
  lng double precision,
  radius_m double precision default 5000,
  lim int default 50
)
returns table (
  id uuid,
  name text,
  facility_type text,
  prefecture text,
  city text,
  address text,
  nearest_station text,
  distance_m double precision
) language sql stable security definer set search_path = public as $$
  select
    f.id, f.name, f.facility_type, f.prefecture, f.city, f.address, f.nearest_station,
    st_distance(f.geom, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_m
  from public.facilities f
  where f.deleted_at is null
    and f.geom is not null
    and st_dwithin(f.geom, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_m)
  order by distance_m
  limit lim;
$$;

-- >>>>>>>>>>>>>>>>>> 0007_profile_fks.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- PostgREST 埋め込み用に、利用者参照カラムの外部キーを
-- public.users(id) から public.profiles(user_id) へ張り替える。
--
-- 理由: アプリは `profiles:organizer_id(...)` のように「列名の外部キー先」を
-- 埋め込む。元の FK は users を指すため display_name 等が引けなかった。
-- profiles.user_id は users(id) を参照する一意キーのため、profiles 経由でも
-- users への整合性は担保される（profiles はサインアップ時にトリガーで自動生成）。
-- =============================================================

-- recruitments.organizer_id
alter table public.recruitments drop constraint if exists recruitments_organizer_id_fkey;
alter table public.recruitments add constraint recruitments_organizer_id_fkey
  foreign key (organizer_id) references public.profiles (user_id) on delete cascade;

-- recruitment_participants.user_id
alter table public.recruitment_participants drop constraint if exists recruitment_participants_user_id_fkey;
alter table public.recruitment_participants add constraint recruitment_participants_user_id_fkey
  foreign key (user_id) references public.profiles (user_id) on delete cascade;

-- chat_messages.sender_id
alter table public.chat_messages drop constraint if exists chat_messages_sender_id_fkey;
alter table public.chat_messages add constraint chat_messages_sender_id_fkey
  foreign key (sender_id) references public.profiles (user_id) on delete set null;

-- facility_reviews.user_id
alter table public.facility_reviews drop constraint if exists facility_reviews_user_id_fkey;
alter table public.facility_reviews add constraint facility_reviews_user_id_fkey
  foreign key (user_id) references public.profiles (user_id) on delete cascade;

-- blocks.blocked_user_id
alter table public.blocks drop constraint if exists blocks_blocked_user_id_fkey;
alter table public.blocks add constraint blocks_blocked_user_id_fkey
  foreign key (blocked_user_id) references public.profiles (user_id) on delete cascade;

-- user_reviews（将来の埋め込みに備えて reviewer/target も揃える）
alter table public.user_reviews drop constraint if exists user_reviews_reviewer_id_fkey;
alter table public.user_reviews add constraint user_reviews_reviewer_id_fkey
  foreign key (reviewer_id) references public.profiles (user_id) on delete cascade;
alter table public.user_reviews drop constraint if exists user_reviews_target_user_id_fkey;
alter table public.user_reviews add constraint user_reviews_target_user_id_fkey
  foreign key (target_user_id) references public.profiles (user_id) on delete cascade;

-- >>>>>>>>>>>>>>>>>> 0008_billing.sql >>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>> 0009_schema_split.sql >>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>> 0010_schema_split_rls.sql >>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>> 0011_golf.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- 0011 golf スキーマ（種目テンプレート）
-- 他種目(running/outdoor/将来の tennis 等)はこのファイルを雛形に複製し、
-- スキーマ名と種目固有列のみ差し替える。account/core/facility は変更しない。
--
-- 外部参照は account.users / core.sports / facility.facilities の3つに限定（疎結合の境界）。
-- =============================================================

create schema if not exists golf;

-- 種目別プロフィール（共通 user_id を参照。認証情報は持たない）
create table golf.user_profiles (
  user_id          uuid primary key references account.users (id) on delete cascade,
  average_score    int,
  handicap         numeric(4, 1),
  preferred_area   text,
  available_days   text[],
  club_owned       boolean not null default false,
  beginner_friendly boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 仲間募集 = 種目イベント（旧 public.recruitments の golf 版）
create table golf.events (
  id                  uuid primary key default uuid_generate_v4(),
  organizer_id        uuid not null references account.users (id) on delete cascade,
  sport_id            uuid references core.sports (id),
  facility_id         uuid references facility.facilities (id) on delete set null,
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
  -- 種目固有
  tee_time            timestamptz,
  course_type         text,
  play_style          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index golf_events_search_idx on golf.events (status, event_start_at);
create index golf_events_area_idx on golf.events (prefecture, city);

create table golf.event_participants (
  event_id            uuid not null references golf.events (id) on delete cascade,
  user_id             uuid not null references account.users (id) on delete cascade,
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
  primary key (event_id, user_id)
);

-- チャット（イベント単位）
create table golf.chat_rooms (
  id         uuid primary key default uuid_generate_v4(),
  event_id   uuid not null unique references golf.events (id) on delete cascade,
  status     chat_room_status not null default 'active',
  created_at timestamptz not null default now()
);
create table golf.chat_room_members (
  chat_room_id uuid not null references golf.chat_rooms (id) on delete cascade,
  user_id      uuid not null references account.users (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  left_at      timestamptz,
  role         chat_member_role not null default 'participant',
  primary key (chat_room_id, user_id)
);
create table golf.chat_messages (
  id           uuid primary key default uuid_generate_v4(),
  chat_room_id uuid not null references golf.chat_rooms (id) on delete cascade,
  sender_id    uuid references account.users (id) on delete set null,
  message_type message_type not null default 'text',
  message      text,
  image_url    text,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index golf_messages_room_idx on golf.chat_messages (chat_room_id, created_at);

-- 種目固有: 予約・スコア
create table golf.reservations (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid references golf.events (id) on delete set null,
  facility_id uuid references facility.facilities (id) on delete set null,
  user_id     uuid not null references account.users (id) on delete cascade,
  reserved_at timestamptz not null,
  status      text not null default 'requested',
  created_at  timestamptz not null default now()
);
create table golf.scores (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid references golf.events (id) on delete set null,
  user_id     uuid not null references account.users (id) on delete cascade,
  total_score int,
  hole_scores jsonb,
  recorded_at timestamptz not null default now()
);

-- 相互評価（開催後）。集計先は account.profiles（種目横断の総合）。
create table golf.user_reviews (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid not null references golf.events (id) on delete cascade,
  reviewer_id uuid not null references account.users (id) on delete cascade,
  reviewee_id uuid not null references account.users (id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  tags        text[],
  comment     text,
  visibility  review_visibility not null default 'restricted',
  created_at  timestamptz not null default now(),
  unique (event_id, reviewer_id, reviewee_id)
);

-- =============================================================
-- RLS
-- =============================================================
create or replace function golf.is_event_member(eid uuid)
returns boolean language sql stable security definer set search_path = golf, public as $$
  select exists (select 1 from golf.events e where e.id = eid and e.organizer_id = auth.uid())
      or exists (
        select 1 from golf.event_participants p
        where p.event_id = eid and p.user_id = auth.uid() and p.status = 'approved'
      );
$$;

alter table golf.user_profiles      enable row level security;
alter table golf.events             enable row level security;
alter table golf.event_participants enable row level security;
alter table golf.chat_rooms         enable row level security;
alter table golf.chat_room_members  enable row level security;
alter table golf.chat_messages      enable row level security;
alter table golf.reservations       enable row level security;
alter table golf.scores             enable row level security;
alter table golf.user_reviews       enable row level security;

-- 種目別プロフィール: 公開読取・本人編集
create policy golf_profile_select on golf.user_profiles for select using (true);
create policy golf_profile_self on golf.user_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- イベント: 公開状態は全員、 下書き/非公開は主催者・管理者
create policy golf_events_public_select on golf.events
  for select using (
    (deleted_at is null and status in ('open','few_left','full','waitlist','finished'))
    or organizer_id = auth.uid() or core.is_admin()
  );
create policy golf_events_insert on golf.events
  for insert with check (organizer_id = auth.uid());
create policy golf_events_update on golf.events
  for update using (organizer_id = auth.uid() or core.is_admin());

-- 参加: 本人と主催者が読取、本人が申請、主催者/本人が更新
create policy golf_part_select on golf.event_participants
  for select using (
    user_id = auth.uid()
    or exists (select 1 from golf.events e where e.id = event_id and e.organizer_id = auth.uid())
    or core.is_admin()
  );
create policy golf_part_insert on golf.event_participants
  for insert with check (user_id = auth.uid());
create policy golf_part_update on golf.event_participants
  for update using (
    user_id = auth.uid()
    or exists (select 1 from golf.events e where e.id = event_id and e.organizer_id = auth.uid())
  );

-- チャット: 承認済みメンバーのみ
create policy golf_room_select on golf.chat_rooms
  for select using (golf.is_event_member(event_id));
create policy golf_member_select on golf.chat_room_members
  for select using (golf.is_event_member((select event_id from golf.chat_rooms r where r.id = chat_room_id)));
create policy golf_msg_select on golf.chat_messages
  for select using (golf.is_event_member((select event_id from golf.chat_rooms r where r.id = chat_room_id)));
create policy golf_msg_insert on golf.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and golf.is_event_member((select event_id from golf.chat_rooms r where r.id = chat_room_id))
  );

-- 予約・スコア: 本人
create policy golf_resv_self on golf.reservations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy golf_score_self on golf.scores
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 相互評価: メンバーが作成、総合評価のみ公開（restricted コメントは本人/評価対象のみ）
create policy golf_review_insert on golf.user_reviews
  for insert with check (reviewer_id = auth.uid() and golf.is_event_member(event_id));
create policy golf_review_select on golf.user_reviews
  for select using (
    visibility = 'public' or reviewer_id = auth.uid() or reviewee_id = auth.uid() or core.is_admin()
  );

-- =============================================================
-- 評価集計トリガー（他ユーザの account.profiles 更新は RLS を越えるため SECURITY DEFINER）
-- 種目横断の総合評価・参加/主催回数を account.profiles に反映する。
-- =============================================================
create or replace function golf.recalc_reviewee_rating()
returns trigger language plpgsql security definer set search_path = golf, account, public as $$
declare avg_rating numeric;
begin
  select coalesce(avg(rating), 0) into avg_rating
  from golf.user_reviews where reviewee_id = new.reviewee_id;
  update account.profiles set rating = round(avg_rating, 2), updated_at = now()
  where user_id = new.reviewee_id;
  return new;
end;
$$;
create trigger golf_review_recalc
  after insert or update on golf.user_reviews
  for each row execute function golf.recalc_reviewee_rating();

-- grant（PostgREST「Exposed schemas」に golf を追加すること）
grant usage on schema golf to anon, authenticated, service_role;
grant all on all tables in schema golf to service_role;
grant select, insert, update, delete on all tables in schema golf to authenticated;
grant select on all tables in schema golf to anon;
alter default privileges in schema golf grant all on tables to service_role;

-- >>>>>>>>>>>>>>>>>> 0012_running_outdoor.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- 0012 running / outdoor スキーマ（golf 雛形の複製）
-- golf(0011) と同型。種目固有列・固有テーブルのみ差し替え。
-- account/core/facility は不変。これが「種目追加時の拡張」の実例。
-- =============================================================

create schema if not exists running;
create schema if not exists outdoor;

-- ============================ running ============================
create table running.user_profiles (
  user_id             uuid primary key references account.users (id) on delete cascade,
  pace                text,
  distance_preference text,
  race_experience     text,
  preferred_time      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table running.courses (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  distance_m int,
  area       text,
  geog       geography(Point, 4326),
  created_by uuid references account.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table running.events (
  id                  uuid primary key default uuid_generate_v4(),
  organizer_id        uuid not null references account.users (id) on delete cascade,
  sport_id            uuid references core.sports (id),
  facility_id         uuid references facility.facilities (id) on delete set null,
  course_id           uuid references running.courses (id) on delete set null,
  title               text not null,
  description         text,
  image_url           text,
  prefecture          text,
  city                text,
  location_description text,
  meeting_place       text,
  event_start_at      timestamptz not null,
  event_end_at        timestamptz,
  application_deadline timestamptz,
  capacity            int not null default 1,
  participation_fee   int not null default 0,
  gender_condition    gender not null default 'unspecified',
  skill_level         skill_level not null default 'any',
  beginner_allowed    boolean not null default true,
  approval_type       approval_type not null default 'approval',
  visibility          visibility not null default 'public',
  status              recruitment_status not null default 'draft',
  target_pace         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index running_events_search_idx on running.events (status, event_start_at);

create table running.event_participants (
  event_id          uuid not null references running.events (id) on delete cascade,
  user_id           uuid not null references account.users (id) on delete cascade,
  status            participant_status not null default 'applied',
  application_message text,
  applied_at        timestamptz not null default now(),
  approved_at       timestamptz,
  cancelled_at      timestamptz,
  attendance_status attendance_status not null default 'unknown',
  primary key (event_id, user_id)
);

create table running.records (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references account.users (id) on delete cascade,
  event_id    uuid references running.events (id) on delete set null,
  distance_m  int,
  duration_s  int,
  recorded_at timestamptz not null default now()
);

create table running.chat_rooms (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null unique references running.events (id) on delete cascade,
  status chat_room_status not null default 'active',
  created_at timestamptz not null default now()
);
create table running.chat_room_members (
  chat_room_id uuid not null references running.chat_rooms (id) on delete cascade,
  user_id uuid not null references account.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  role chat_member_role not null default 'participant',
  primary key (chat_room_id, user_id)
);
create table running.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  chat_room_id uuid not null references running.chat_rooms (id) on delete cascade,
  sender_id uuid references account.users (id) on delete set null,
  message_type message_type not null default 'text',
  message text,
  image_url text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================ outdoor ============================
create table outdoor.user_profiles (
  user_id              uuid primary key references account.users (id) on delete cascade,
  activity_type        text,
  experience_level     text,
  gear_owned           text[],
  transportation       text,
  solo_participation_ok boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table outdoor.spots (
  id        uuid primary key default uuid_generate_v4(),
  name      text not null,
  spot_type text,
  area      text,
  latitude  double precision,
  longitude double precision,
  geog      geography(Point, 4326),
  created_at timestamptz not null default now()
);

create table outdoor.events (
  id                  uuid primary key default uuid_generate_v4(),
  organizer_id        uuid not null references account.users (id) on delete cascade,
  sport_id            uuid references core.sports (id),
  facility_id         uuid references facility.facilities (id) on delete set null,
  spot_id             uuid references outdoor.spots (id) on delete set null,
  title               text not null,
  description         text,
  image_url           text,
  prefecture          text,
  city                text,
  location_description text,
  meeting_place       text,
  event_start_at      timestamptz not null,
  event_end_at        timestamptz,
  application_deadline timestamptz,
  capacity            int not null default 1,
  participation_fee   int not null default 0,
  gender_condition    gender not null default 'unspecified',
  skill_level         skill_level not null default 'any',
  beginner_allowed    boolean not null default true,
  approval_type       approval_type not null default 'approval',
  visibility          visibility not null default 'public',
  status              recruitment_status not null default 'draft',
  activity_type       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index outdoor_events_search_idx on outdoor.events (status, event_start_at);

create table outdoor.event_participants (
  event_id          uuid not null references outdoor.events (id) on delete cascade,
  user_id           uuid not null references account.users (id) on delete cascade,
  status            participant_status not null default 'applied',
  application_message text,
  applied_at        timestamptz not null default now(),
  approved_at       timestamptz,
  cancelled_at      timestamptz,
  attendance_status attendance_status not null default 'unknown',
  primary key (event_id, user_id)
);

create table outdoor.gear (
  id       uuid primary key default uuid_generate_v4(),
  user_id  uuid not null references account.users (id) on delete cascade,
  name     text not null,
  category text,
  note     text
);

create table outdoor.chat_rooms (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null unique references outdoor.events (id) on delete cascade,
  status chat_room_status not null default 'active',
  created_at timestamptz not null default now()
);
create table outdoor.chat_room_members (
  chat_room_id uuid not null references outdoor.chat_rooms (id) on delete cascade,
  user_id uuid not null references account.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  role chat_member_role not null default 'participant',
  primary key (chat_room_id, user_id)
);
create table outdoor.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  chat_room_id uuid not null references outdoor.chat_rooms (id) on delete cascade,
  sender_id uuid references account.users (id) on delete set null,
  message_type message_type not null default 'text',
  message text,
  image_url text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================ RLS（golf と同型・最小） ============================
do $$
declare s text;
begin
  foreach s in array array['running','outdoor'] loop
    execute format('alter table %I.user_profiles enable row level security', s);
    execute format('alter table %I.events enable row level security', s);
    execute format('alter table %I.event_participants enable row level security', s);
    execute format('alter table %I.chat_rooms enable row level security', s);
    execute format('alter table %I.chat_room_members enable row level security', s);
    execute format('alter table %I.chat_messages enable row level security', s);

    execute format('create policy %I_profile_select on %I.user_profiles for select using (true)', s, s);
    execute format('create policy %I_profile_self on %I.user_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid())', s, s);

    execute format($f$create policy %I_events_select on %I.events for select using ((deleted_at is null and status in ('open','few_left','full','waitlist','finished')) or organizer_id = auth.uid() or core.is_admin())$f$, s, s);
    execute format('create policy %I_events_insert on %I.events for insert with check (organizer_id = auth.uid())', s, s);
    execute format('create policy %I_events_update on %I.events for update using (organizer_id = auth.uid() or core.is_admin())', s, s);

    execute format('create policy %I_part_insert on %I.event_participants for insert with check (user_id = auth.uid())', s, s);
    execute format($f$create policy %I_part_select on %I.event_participants for select using (user_id = auth.uid() or exists (select 1 from %I.events e where e.id = event_id and e.organizer_id = auth.uid()) or core.is_admin())$f$, s, s, s);

    execute format('grant usage on schema %I to anon, authenticated, service_role', s);
    execute format('grant all on all tables in schema %I to service_role', s);
    execute format('grant select, insert, update, delete on all tables in schema %I to authenticated', s);
    execute format('grant select on all tables in schema %I to anon', s);
  end loop;
end $$;

-- >>>>>>>>>>>>>>>>>> 0013_chat_rls_realtime.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- 0013 running/outdoor のチャット RLS（golf と同型）＋ Realtime publication
-- 0012 では chat_* で RLS を有効化したがポリシー未作成（=全拒否）だった。golf 相当を付与。
-- =============================================================

do $$
declare s text;
begin
  foreach s in array array['running','outdoor'] loop
    -- is_event_member(eid)
    execute format($f$
      create or replace function %I.is_event_member(eid uuid)
      returns boolean language sql stable security definer set search_path = %I, public as $body$
        select exists (select 1 from %I.events e where e.id = eid and e.organizer_id = auth.uid())
            or exists (
              select 1 from %I.event_participants p
              where p.event_id = eid and p.user_id = auth.uid() and p.status = 'approved'
            );
      $body$;
    $f$, s, s, s, s);

    execute format('create policy %I_room_select on %I.chat_rooms for select using (%I.is_event_member(event_id))', s, s, s);
    execute format('create policy %I_member_select on %I.chat_room_members for select using (%I.is_event_member((select event_id from %I.chat_rooms r where r.id = chat_room_id)))', s, s, s, s);
    execute format('create policy %I_msg_select on %I.chat_messages for select using (%I.is_event_member((select event_id from %I.chat_rooms r where r.id = chat_room_id)))', s, s, s, s);
    execute format('create policy %I_msg_insert on %I.chat_messages for insert with check (sender_id = auth.uid() and %I.is_event_member((select event_id from %I.chat_rooms r where r.id = chat_room_id)))', s, s, s, s);
  end loop;
end $$;

-- Realtime publication（グループチャットの新着メッセージ購読用）
alter publication supabase_realtime add table golf.chat_messages;
alter publication supabase_realtime add table running.chat_messages;
alter publication supabase_realtime add table outdoor.chat_messages;

-- >>>>>>>>>>>>>>>>>> 0014_social.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- 0014 相互評価(running/outdoor)・お気に入り・フォロー
-- 評価の総合値(account.profiles.rating)は種目横断で集計する（設計方針）。
-- =============================================================

-- ---- running/outdoor の相互評価テーブル（golf 0011 と同型）----
do $$
declare s text;
begin
  foreach s in array array['running','outdoor'] loop
    execute format($f$
      create table %I.user_reviews (
        id          uuid primary key default uuid_generate_v4(),
        event_id    uuid not null references %I.events (id) on delete cascade,
        reviewer_id uuid not null references account.users (id) on delete cascade,
        reviewee_id uuid not null references account.users (id) on delete cascade,
        rating      int not null check (rating between 1 and 5),
        tags        text[],
        comment     text,
        visibility  review_visibility not null default 'restricted',
        created_at  timestamptz not null default now(),
        unique (event_id, reviewer_id, reviewee_id)
      )
    $f$, s, s);
    execute format('alter table %I.user_reviews enable row level security', s);
    execute format('create policy %I_review_insert on %I.user_reviews for insert with check (reviewer_id = auth.uid() and %I.is_event_member(event_id))', s, s, s);
    execute format($f$create policy %I_review_select on %I.user_reviews for select using (visibility = 'public' or reviewer_id = auth.uid() or reviewee_id = auth.uid() or core.is_admin())$f$, s, s);
    execute format('grant select, insert, update, delete on %I.user_reviews to authenticated', s);
    execute format('grant all on %I.user_reviews to service_role', s);
  end loop;
end $$;

-- ---- 種目横断の総合評価集計（全種目の user_reviews を union）----
-- 新種目を追加したら、この関数に union を1行足すこと。
create or replace function core.recalc_user_rating(uid uuid)
returns void language plpgsql security definer set search_path = core, account, golf, running, outdoor, public as $$
declare avg_rating numeric;
begin
  select coalesce(avg(rating), 0) into avg_rating from (
    select rating from golf.user_reviews    where reviewee_id = uid
    union all
    select rating from running.user_reviews where reviewee_id = uid
    union all
    select rating from outdoor.user_reviews where reviewee_id = uid
  ) all_reviews;
  update account.profiles set rating = round(avg_rating, 2), updated_at = now() where user_id = uid;
end;
$$;

-- golf の旧トリガー（golf 単独集計）を core 集計へ差し替え
drop trigger if exists golf_review_recalc on golf.user_reviews;
drop function if exists golf.recalc_reviewee_rating();

create or replace function core.review_recalc_trigger()
returns trigger language plpgsql security definer set search_path = core, public as $$
begin
  perform core.recalc_user_rating(new.reviewee_id);
  return new;
end;
$$;

create trigger golf_review_recalc    after insert or update on golf.user_reviews    for each row execute function core.review_recalc_trigger();
create trigger running_review_recalc after insert or update on running.user_reviews for each row execute function core.review_recalc_trigger();
create trigger outdoor_review_recalc after insert or update on outdoor.user_reviews for each row execute function core.review_recalc_trigger();

-- ---- お気に入り（種目横断・募集/施設/主催者/エリア等）----
create table core.favorites (
  user_id     uuid not null references account.users (id) on delete cascade,
  target_type favorite_target not null,
  target_id   text not null,
  domain      text,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
alter table core.favorites enable row level security;
create policy favorites_self on core.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- 主催者フォロー ----
create table core.follows (
  follower_id uuid not null references account.users (id) on delete cascade,
  followee_id uuid not null references account.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id)
);
alter table core.follows enable row level security;
create policy follows_self on core.follows
  for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy follows_visible on core.follows
  for select using (follower_id = auth.uid() or followee_id = auth.uid());

grant select, insert, update, delete on core.favorites, core.follows to authenticated;
grant all on core.favorites, core.follows to service_role;

-- >>>>>>>>>>>>>>>>>> 0015_auth_signup_trigger.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- 0015 新規 auth.users → account.users + account.profiles 自動生成（スキーマ分離対応）
--
-- 0001 の handle_new_user は public.users/profiles を対象にしていたが、0009 でそれらを
-- drop したため壊れていた。account スキーマを対象に作り直す。これにより
-- メール/Google/Apple/LINE/電話 いずれの新規登録でも account 行が生成される。
-- =============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = account, public as $$
begin
  insert into account.users (id, email, phone, email_verified_at, phone_verified_at)
    values (new.id, new.email, new.phone, new.email_confirmed_at, new.phone_confirmed_at)
    on conflict (id) do update
      set email = excluded.email,
          phone = excluded.phone,
          email_verified_at = coalesce(account.users.email_verified_at, excluded.email_verified_at),
          phone_verified_at = coalesce(account.users.phone_verified_at, excluded.phone_verified_at);

  insert into account.profiles (user_id, nickname)
    values (
      new.id,
      coalesce(
        new.raw_user_meta_data ->> 'nickname',
        new.raw_user_meta_data ->> 'display_name',
        new.raw_user_meta_data ->> 'name',
        new.raw_user_meta_data ->> 'full_name',
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        '名称未設定'
      )
    )
    on conflict (user_id) do nothing;

  return new;
end;
$$;

-- トリガーが消えていた場合に備えて貼り直す
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- メール確認/電話確認の後追い反映（任意・確認タイムスタンプ同期）
create or replace function public.handle_user_updated()
returns trigger language plpgsql security definer set search_path = account, public as $$
begin
  update account.users
    set email = new.email,
        phone = new.phone,
        email_verified_at = new.email_confirmed_at,
        phone_verified_at = new.phone_confirmed_at,
        updated_at = now()
    where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_updated();

-- >>>>>>>>>>>>>>>>>> seed.sql >>>>>>>>>>>>>>>>>>

-- =============================================================
-- スポーツ・レジャーカテゴリー seed （仕様 §5）
-- カテゴリーは管理画面から追加・変更・並び替え・公開停止が可能。
-- =============================================================

insert into core.sports (category_type, name, slug, display_order) values
  -- 5.1 スポーツ・レジャー
  ('sports', 'ゴルフ',           'golf',          10),
  ('sports', 'テニス',           'tennis',        20),
  ('sports', '卓球',             'table-tennis',  30),
  ('sports', 'バドミントン',     'badminton',     40),
  ('sports', 'サッカー',         'soccer',        50),
  ('sports', 'フットサル',       'futsal',        60),
  ('sports', '野球',             'baseball',      70),
  ('sports', 'ソフトボール',     'softball',      80),
  ('sports', 'バスケットボール', 'basketball',    90),
  ('sports', 'バレーボール',     'volleyball',   100),
  ('sports', 'ランニング',       'running',      110),
  ('sports', 'ジョギング',       'jogging',      120),
  ('sports', 'マラソン',         'marathon',     130),
  ('sports', 'ウォーキング',     'walking',      140),
  ('sports', 'サイクリング',     'cycling',      150),
  ('sports', '水泳',             'swimming',     160),
  ('sports', 'ヨガ',             'yoga',         170),
  ('sports', 'フィットネス',     'fitness',      180),
  ('sports', '筋力トレーニング', 'strength',     190),
  ('sports', 'ボウリング',       'bowling',      200),
  ('sports', 'ビリヤード',       'billiards',    210),
  ('sports', 'ダーツ',           'darts',        220),
  ('sports', '格闘技',           'martial-arts', 230),
  ('sports', 'ダンス',           'dance',        240),
  ('sports', 'スポーツ観戦',     'spectating',   250),
  ('sports', 'モータースポーツ', 'motorsports',  260),
  ('sports', 'その他のスポーツ', 'other-sports', 270),
  -- 5.2 アウトドア・レジャー
  ('outdoor', '登山',               'mountaineering', 10),
  ('outdoor', 'ハイキング',         'hiking',         20),
  ('outdoor', 'トレッキング',       'trekking',       30),
  ('outdoor', 'キャンプ',           'camping',        40),
  ('outdoor', 'グランピング',       'glamping',       50),
  ('outdoor', 'バーベキュー',       'bbq',            60),
  ('outdoor', 'ピクニック',         'picnic',         70),
  ('outdoor', '釣り',               'fishing',        80),
  ('outdoor', '海水浴',             'sea-bathing',    90),
  ('outdoor', 'サーフィン',         'surfing',       100),
  ('outdoor', 'ダイビング',         'diving',        110),
  ('outdoor', 'シュノーケリング',   'snorkeling',    120),
  ('outdoor', 'カヌー',             'canoe',         130),
  ('outdoor', 'カヤック',           'kayak',         140),
  ('outdoor', 'ラフティング',       'rafting',       150),
  ('outdoor', 'スキー',             'ski',           160),
  ('outdoor', 'スノーボード',       'snowboard',     170),
  ('outdoor', 'ツーリング',         'touring',       180),
  ('outdoor', 'ドライブ',           'drive',         190),
  ('outdoor', '公園散策',           'park-walk',     200),
  ('outdoor', '星空観賞',           'stargazing',    210),
  ('outdoor', '自然観察',           'nature-watch',  220),
  ('outdoor', 'アウトドア写真撮影', 'outdoor-photo', 230),
  ('outdoor', 'その他のアウトドア', 'other-outdoor', 240)
on conflict (slug) do nothing;

-- 施設運営者プラン（収益化 Phase A）。stripe_price_id は環境ごとに後から設定。
insert into facility.subscription_plans (code, name, description, amount, billing_interval, entitlements, display_order) values
  ('basic', 'ベーシック', '検索上位表示・画像枠拡張', 3000, 'month',
   '{"promotion_rank": 1, "max_images": 10, "analytics": false}'::jsonb, 10),
  ('pro', 'プロ', '上位表示強化・リード分析', 8000, 'month',
   '{"promotion_rank": 3, "max_images": 30, "analytics": true}'::jsonb, 20)
on conflict (code) do nothing;
