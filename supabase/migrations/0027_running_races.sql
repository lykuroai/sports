-- =============================================================
-- 0027 running.races: マラソン・駅伝・ロードレース等の競技大会データ
-- 施設(facility.facilities)と同様、種目内の「探す」対象となる参照データ。
-- 募集とは独立した公開カタログ（誰でも閲覧可・書き込みは管理者=サービスロール）。
-- 初期データは data/running/collect_races.py が Wikipedia/Wikidata から収集（0028 で投入）。
-- =============================================================

create table running.races (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  prefecture      text,
  city            text,
  website_url     text,
  latitude        double precision,
  longitude       double precision,
  geog            geography(Point, 4326),
  source          text not null default 'wikipedia',   -- 出所（wikipedia / manual / csv 等）
  source_id       text,                                 -- Wikidata QID 等の外部ID
  wikipedia_title text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index running_races_pref_idx on running.races (prefecture, name);
-- 同一出所の重複投入を防ぐ（source_id があるものだけ一意）。再収集時の upsert キー。
create unique index running_races_source_uq
  on running.races (source, source_id) where source_id is not null and source_id <> '';

-- 緯度経度から geography を自動設定（現在地周辺検索 nearby と整合）。
create or replace function running.races_set_geog() returns trigger
language plpgsql as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.geog := ('SRID=4326;POINT(' || new.longitude || ' ' || new.latitude || ')')::geography;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger running_races_geog
  before insert or update on running.races
  for each row execute function running.races_set_geog();

-- ---------------- RLS（施設と同型：公開読み取り・書き込みは管理者/サービスロール） ----------------
alter table running.races enable row level security;

create policy races_select on running.races
  for select using (true);
create policy races_admin_write on running.races
  for all using (core.is_admin()) with check (core.is_admin());

grant select on running.races to anon, authenticated;
grant all on running.races to service_role;
