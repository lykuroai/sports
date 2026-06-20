-- =============================================================
-- 0020 ゴルフ場予約：楽天GORA 連携（送客モデル）
-- 仕様: rakuten_gora_reservation_spec.md
--   - 本システム内で予約・決済は行わない。楽天GORA予約ページへ送客する。
--   - 主催者が選んだ GORA ゴルフ場・プランを 仲間募集（golf.events）に紐づける。
--   - 予約確定は楽天GORA側。本システムは予約状態を主催者が手動更新するのみ。
-- 外部参照は account.users / facility.facilities / golf.events に限定。
-- =============================================================

-- -------------------------------------------------------------
-- 9.1 golf_courses : 楽天GORA ゴルフ場の永続記録（facilities と任意リンク）
-- -------------------------------------------------------------
create table golf.golf_courses (
  id                     uuid primary key default uuid_generate_v4(),
  facility_id            uuid references facility.facilities (id) on delete set null,
  rakuten_gora_course_id text not null unique,
  golf_course_name       text not null,
  area_code              text,
  prefecture             text,
  address                text,
  latitude               numeric,
  longitude              numeric,
  golf_course_url        text,
  rating                 numeric,
  source_updated_at      timestamptz,  -- 楽天GORA 情報の取得・更新日時
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 9.2 golf_plans : 募集に紐づく楽天GORA プランのスナップショット
--     料金・空き枠は変動するため、募集作成時点の値を保持し reserve_url で送客する。
-- -------------------------------------------------------------
create table golf.golf_plans (
  id                     uuid primary key default uuid_generate_v4(),
  event_id               uuid references golf.events (id) on delete cascade,
  rakuten_gora_course_id text,
  rakuten_gora_plan_id   text,
  play_date              date,
  start_time_zone        text,
  plan_name              text,
  price                  integer,
  min_players            integer,
  max_players            integer,
  lunch_included         boolean,
  caddie_included        boolean,
  cart_type              text,
  two_sum_guaranteed     boolean,
  three_b_extra_fee      integer,
  four_b_price           integer,
  cancel_fee_flag        boolean,
  cancel_fee_description text,
  reserve_url            text,
  raw_response           jsonb,        -- 楽天GORA API レスポンス保存用
  fetched_at             timestamptz,  -- API 取得日時
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index golf_plans_event_idx on golf.golf_plans (event_id);

-- -------------------------------------------------------------
-- 9.3 event_golf_details : 募集（golf.events）とゴルフ予約情報の関連
--     reservation_status は主催者が手動更新（楽天GORA側の確定を反映）。
-- -------------------------------------------------------------
create table golf.event_golf_details (
  event_id                  uuid primary key references golf.events (id) on delete cascade,
  golf_course_id            uuid references golf.golf_courses (id) on delete set null,
  golf_plan_id              uuid references golf.golf_plans (id) on delete set null,
  reservation_status        text not null default 'not_reserved'
    check (reservation_status in
      ('not_reserved','planning','reserved_external','changed_external','cancelled_external','unknown')),
  external_reservation_note text,
  confirmed_by              uuid references account.users (id) on delete set null,
  confirmed_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 主催者判定（RLS 用）。golf.is_event_member と同型。
-- -------------------------------------------------------------
create or replace function golf.is_event_organizer(eid uuid)
returns boolean language sql stable security definer set search_path = golf, public as $$
  select exists (select 1 from golf.events e where e.id = eid and e.organizer_id = auth.uid());
$$;

-- =============================================================
-- RLS
--   ゴルフ場・プラン・予約情報はいずれも「公開募集」に付随する公開情報のため select は全許可。
--   書き込みは: golf_courses はログインユーザのキャッシュ upsert、
--               golf_plans / event_golf_details は当該募集の主催者のみ。
-- =============================================================
alter table golf.golf_courses        enable row level security;
alter table golf.golf_plans          enable row level security;
alter table golf.event_golf_details  enable row level security;

create policy golf_courses_select on golf.golf_courses for select using (true);
create policy golf_courses_insert on golf.golf_courses for insert to authenticated with check (true);
create policy golf_courses_update on golf.golf_courses for update to authenticated using (true) with check (true);

create policy golf_plans_select on golf.golf_plans for select using (true);
create policy golf_plans_owner_write on golf.golf_plans
  for all to authenticated
  using (event_id is null or golf.is_event_organizer(event_id))
  with check (event_id is null or golf.is_event_organizer(event_id));

create policy golf_details_select on golf.event_golf_details for select using (true);
create policy golf_details_owner_write on golf.event_golf_details
  for all to authenticated
  using (golf.is_event_organizer(event_id))
  with check (golf.is_event_organizer(event_id));

-- -------------------------------------------------------------
-- GRANT（golf スキーマの新規テーブルは明示付与）
-- -------------------------------------------------------------
grant select on golf.golf_courses, golf.golf_plans, golf.event_golf_details to anon;
grant select, insert, update, delete on golf.golf_courses, golf.golf_plans, golf.event_golf_details to authenticated;
grant all on golf.golf_courses, golf.golf_plans, golf.event_golf_details to service_role;
grant execute on function golf.is_event_organizer(uuid) to anon, authenticated, service_role;
