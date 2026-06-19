-- =============================================================
-- 一括セットアップ用SQL（migrations 0001〜0007 + seed を結合）
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。
-- =============================================================


-- >>>>>>>>>>>>>>>>>> migrations/0001_init.sql >>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>> migrations/0002_rls.sql >>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>> migrations/0003_reviews.sql >>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>> migrations/0004_admin.sql >>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>> migrations/0005_blocks.sql >>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>> migrations/0006_geo.sql >>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>> migrations/0007_profile_fks.sql >>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>> seed.sql >>>>>>>>>>>>>>>>>>
-- =============================================================
-- スポーツ・レジャーカテゴリー seed （仕様 §5）
-- カテゴリーは管理画面から追加・変更・並び替え・公開停止が可能。
-- =============================================================

insert into public.sports (category_type, name, slug, display_order) values
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

