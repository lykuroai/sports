-- =============================================================
-- 0034 merge_facilities の堅牢化（存在しない参照テーブルでも動くよう修正）
-- 根拠: 0033 が facility.facility_subscriptions を直接参照していたが、同テーブルは
--       0025 で廃止済み（drop）。本番で "relation does not exist" となり全統合が失敗
--       （原子的なためロールバックされデータは無傷）。
--
-- 対策: facility.facilities(id) を参照する「任意・将来変動しうる」テーブルは to_regclass で
--   存在を確認し、存在する場合のみ動的 SQL で付け替える。これによりスキーマ差異
--   （golf/outdoor の有無、廃止テーブル等）に依存せず安全に統合できる。
-- =============================================================

create or replace function facility.merge_facilities(p_keep uuid, p_drop uuid)
returns void
language plpgsql
security definer
set search_path = facility, core, golf, running, outdoor, public
as $$
declare
  -- facility_id を単純参照する（複合PK/ユニーク制約の無い）テーブル群。
  -- 存在するものだけ付け替える。
  simple_refs text[] := array[
    'facility.facility_images',
    'facility.facility_submissions',
    'facility.facility_subscriptions',
    'golf.events',
    'golf.reservations',
    'golf.golf_courses',
    'running.events',
    'outdoor.events'
  ];
  t text;
begin
  if p_keep is null or p_drop is null then
    raise exception 'merge_facilities: keep/drop は必須です';
  end if;
  if p_keep = p_drop then
    raise exception 'merge_facilities: keep と drop が同一です (%).', p_keep;
  end if;
  if not exists (select 1 from facility.facilities where id = p_keep) then
    raise exception 'merge_facilities: keep が存在しません (%).', p_keep;
  end if;
  if not exists (select 1 from facility.facilities where id = p_drop) then
    raise exception 'merge_facilities: drop が存在しません (%).', p_drop;
  end if;

  -- 1) keep の欠損カラムを drop の値で補完。status は verified を優先。
  update facility.facilities k set
    facility_type = coalesce(k.facility_type, d.facility_type),
    description   = coalesce(k.description,   d.description),
    postal_code   = coalesce(k.postal_code,   d.postal_code),
    prefecture    = coalesce(k.prefecture,    d.prefecture),
    city          = coalesce(k.city,          d.city),
    address       = coalesce(k.address,       d.address),
    latitude      = coalesce(k.latitude,      d.latitude),
    longitude     = coalesce(k.longitude,     d.longitude),
    geog          = coalesce(k.geog,          d.geog),
    status        = case when k.status = 'verified' or d.status = 'verified'
                         then 'verified'::verification_status else k.status end,
    updated_at    = now()
  from facility.facilities d
  where k.id = p_keep and d.id = p_drop;

  -- 2) 複合PK/ユニークのある子：keep に無い行だけ移し、残りは drop 削除で cascade。
  insert into facility.facility_sports (facility_id, sport_id)
    select p_keep, sport_id from facility.facility_sports where facility_id = p_drop
    on conflict do nothing;

  insert into facility.facility_features (facility_id, feature_key, value)
    select p_keep, feature_key, value from facility.facility_features where facility_id = p_drop
    on conflict do nothing;

  insert into facility.facility_owners (facility_id, user_id, status, verified_at)
    select p_keep, user_id, status, verified_at from facility.facility_owners where facility_id = p_drop
    on conflict do nothing;

  update facility.facility_reviews r set facility_id = p_keep
    where r.facility_id = p_drop
      and not exists (
        select 1 from facility.facility_reviews k
        where k.facility_id = p_keep and k.user_id = r.user_id
      );

  update facility.facility_sources s set facility_id = p_keep
    where s.facility_id = p_drop
      and (
        s.source_id is null
        or not exists (
          select 1 from facility.facility_sources k
          where k.source_type = s.source_type and k.source_id = s.source_id
            and k.facility_id = p_keep
        )
      );

  -- 3) 単純参照：存在するテーブルだけ facility_id を keep へ更新。
  foreach t in array simple_refs loop
    if to_regclass(t) is not null then
      execute format('update %s set facility_id = $1 where facility_id = $2', t)
        using p_keep, p_drop;
    end if;
  end loop;

  -- 4) 重複側を削除（残った子行は ON DELETE CASCADE で消える）。
  delete from facility.facilities where id = p_drop;
end;
$$;

revoke all on function facility.merge_facilities(uuid, uuid) from public;
grant execute on function facility.merge_facilities(uuid, uuid) to service_role;
