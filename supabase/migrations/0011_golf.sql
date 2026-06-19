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
