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
