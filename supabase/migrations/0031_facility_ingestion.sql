-- =============================================================
-- 0031 施設データ取り込み基盤（統合サイト化 Phase 2）
-- 根拠: docs/仕様変更/sports_leisure_facility_data_design_v1_2.md (§4,§11,§15,§16.3)
--       docs/仕様変更/sports_leisure_system_architecture_design_v1_0.md (§6.3,§7,§14.3)
--       docs/仕様変更/0_移行設計_統合サイト化.md (Phase 2)
--
-- 方針（重要・意図的逸脱の記録）:
--   * 既存 facility.facilities / facility_sports / facility_features / facility_images /
--     facility_submissions は「1施設DB」を既に満たすため再構築しない。新仕様の
--     facility_categories / facility_details(平坦) は既存の facility_sports(core.sports
--     ツリーへ正規化) / facility_features(key-value) の方が正規化が進んでおり優位なため
--     採用しない。Phase 2 では新仕様で唯一不足する「外部取り込み基盤」だけを追加する。
--   * 主キーは UUID 維持（仕様の BIGSERIAL は不採用＝0_移行設計 §5）。
--
-- 追加するもの:
--   1. facility.facility_sources  … 取得元の出所（複数）+ raw_data + license（Google/OSM/
--      自治体/国土/楽天GORA/手動）。重複判定・再取得・帰属表示の根拠。
--   2. facilities.normalized_name / last_checked_at … 重複判定・閉鎖確認バッチ用。
--   3. facility.normalize_name() / find_duplicate_candidates() … 名称正規化・重複候補抽出。
--   4. core.batch_runs / core.batch_run_logs … 外部取得バッチの実行履歴・エラー記録。
-- =============================================================

create extension if not exists pg_trgm;

-- -------------------------------------------------------------
-- 1. facilities への追加カラム（非破壊）
-- -------------------------------------------------------------
alter table facility.facilities
  add column if not exists normalized_name text,
  add column if not exists last_checked_at timestamptz;

-- -------------------------------------------------------------
-- 2. 名称正規化関数（重複判定の基盤・facility_data §15.2）
--    全角半角・大小文字・空白・記号・法人格・施設種別語尾を素朴に正規化する。
-- -------------------------------------------------------------
create or replace function facility.normalize_name(p_name text)
returns text language sql immutable as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        lower(coalesce(p_name, '')),
        '(株式会社|有限会社|一般社団法人|公益財団法人|\s|　|・|（|）|\(|\)|\[|\]|「|」|,|，|\.|。|-|―|ー)', '', 'g'
      ),
      '(ゴルフクラブ|ゴルフ倶楽部|golfclub|gc|カントリークラブ|countryclub|cc)$', '', 'g'
    ),
    ''
  );
$$;

create index if not exists facilities_normalized_name_idx
  on facility.facilities (normalized_name);
create index if not exists facilities_name_trgm_idx
  on facility.facilities using gin (name gin_trgm_ops);

-- name から normalized_name を常に同期（insert/update 時）。バッチ取り込みの重複判定が
-- find_duplicate_candidates の normalize と一致するよう DB 側で一元化する。
create or replace function facility.set_normalized_name()
returns trigger language plpgsql as $$
begin
  new.normalized_name := facility.normalize_name(new.name);
  return new;
end;
$$;

drop trigger if exists trg_facilities_normalize on facility.facilities;
create trigger trg_facilities_normalize
  before insert or update of name on facility.facilities
  for each row execute function facility.set_normalized_name();

-- 既存行の normalized_name を埋める
update facility.facilities
  set normalized_name = facility.normalize_name(name)
  where normalized_name is null;

-- -------------------------------------------------------------
-- 3. facility_sources（取得元の出所。複数ソース対応）
--    source_type は enum ではなく TEXT（新仕様 §6.3）。値の例:
--    google_places / openstreetmap / municipal_open_data / mlit_national_land /
--    rakuten_gora / manual_admin / manual_owner / manual_user / csv_import
-- -------------------------------------------------------------
create table if not exists facility.facility_sources (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facility.facilities (id) on delete cascade,
  source_type text not null,
  source_id   text,
  source_name text,
  source_url  text,
  license     text,
  raw_data    jsonb,
  fetched_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists facility_sources_facility_idx
  on facility.facility_sources (facility_id);
-- 同一外部IDの再取得を upsert するためのキー
create unique index if not exists facility_sources_extid_uidx
  on facility.facility_sources (source_type, source_id)
  where source_id is not null;

-- 既存 facilities.source(enum) を facility_sources へバックフィル（1行ずつ）
insert into facility.facility_sources (facility_id, source_type, source_name, fetched_at, created_at)
select f.id,
       case f.source
         when 'admin'           then 'manual_admin'
         when 'user_submission' then 'manual_user'
         when 'csv_import'      then 'csv_import'
         when 'opendata'        then 'municipal_open_data'
         when 'partner_api'     then 'rakuten_gora'
         else f.source::text
       end,
       '0009 由来の既存施設（自動移行）',
       f.created_at, f.created_at
from facility.facilities f
where not exists (
  select 1 from facility.facility_sources s where s.facility_id = f.id
);

-- -------------------------------------------------------------
-- 4. 重複候補抽出 RPC（facility_data §15）
--    名称の類似(trgm) または 半径内(PostGIS) の施設を候補として返す。
--    管理画面の重複確認・取り込みバッチの重複判定から利用する。
-- -------------------------------------------------------------
create or replace function facility.find_duplicate_candidates(
  p_name     text,
  p_lat      double precision,
  p_lng      double precision,
  p_radius_m int default 100,
  p_lim      int default 20
)
returns table (
  id          uuid,
  name        text,
  prefecture  text,
  city        text,
  address     text,
  name_sim    real,
  distance_m  double precision
) language sql stable set search_path = facility, public as $$
  select
    f.id, f.name, f.prefecture, f.city, f.address,
    similarity(f.name, p_name) as name_sim,
    case when f.geog is not null and p_lat is not null and p_lng is not null
      then ST_Distance(f.geog, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
      else null end as distance_m
  from facility.facilities f
  where
    f.normalized_name = facility.normalize_name(p_name)
    or similarity(f.name, p_name) > 0.3
    or (
      f.geog is not null and p_lat is not null and p_lng is not null
      and ST_DWithin(f.geog, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_m)
    )
  order by name_sim desc nulls last, distance_m asc nulls last
  limit p_lim;
$$;

-- -------------------------------------------------------------
-- 5. 外部取得バッチの実行履歴（architecture §14.3 / facility_data §11）
-- -------------------------------------------------------------
create table if not exists core.batch_runs (
  id            uuid primary key default gen_random_uuid(),
  job_name      text not null,
  status        text not null default 'running',  -- running | success | failed | partial
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  total_count   int not null default 0,
  success_count int not null default 0,
  failed_count  int not null default 0,
  error_message text,
  created_at    timestamptz not null default now()
);
create index if not exists batch_runs_job_idx on core.batch_runs (job_name, started_at desc);

create table if not exists core.batch_run_logs (
  id           uuid primary key default gen_random_uuid(),
  batch_run_id uuid not null references core.batch_runs (id) on delete cascade,
  level        text not null default 'info',  -- info | warn | error
  message      text not null,
  detail       jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists batch_run_logs_run_idx on core.batch_run_logs (batch_run_id, created_at);

-- -------------------------------------------------------------
-- 6. RLS（取り込み系は管理者のみ。raw_data に外部データを含むため非公開）
-- -------------------------------------------------------------
alter table facility.facility_sources enable row level security;
alter table core.batch_runs           enable row level security;
alter table core.batch_run_logs       enable row level security;

create policy fac_sources_admin_select on facility.facility_sources
  for select using (core.is_admin());
create policy fac_sources_admin_write on facility.facility_sources
  for all using (core.is_admin()) with check (core.is_admin());

create policy batch_runs_admin_select on core.batch_runs
  for select using (core.is_admin());
create policy batch_run_logs_admin_select on core.batch_run_logs
  for select using (core.is_admin());

-- -------------------------------------------------------------
-- 7. grant（書き込みはサービスロール＝バッチ/管理操作。読み取りは RLS で管理者限定）
-- -------------------------------------------------------------
grant all on facility.facility_sources, core.batch_runs, core.batch_run_logs to service_role;
grant select on facility.facility_sources, core.batch_runs, core.batch_run_logs to authenticated;
