-- =============================================================
-- 0033 施設の統合 RPC（重複レコードを1本へ集約）
-- 根拠: 依頼「現DBの施設データ重複を統合して（一回のみ・手動ツール）」
--
-- facility.facilities(id) を参照する全テーブルを存続側(p_keep)へ付け替え、重複側
-- (p_drop) を削除する。単一 plpgsql 関数＝単一トランザクションで原子的に行う。
-- 仕様 §6.6（自動統合せず管理者確認）の原則に対し、本関数は「管理者が確認のうえ
-- 明示的に実行する手動ツール」から呼ぶ前提（自動バッチからは呼ばない）。
--
-- 付け替え方針:
--   * 複合PK/ユニーク制約のある子（facility_sports / facility_features / facility_owners /
--     facility_reviews / facility_sources）は keep に無い行だけ移し、重複は drop 削除時の
--     ON DELETE CASCADE に任せる（PK/unique 衝突を避ける）。
--   * 単純参照（facility_images / facility_submissions / facility_subscriptions /
--     golf.events / golf.reservations / running.events / outdoor.events /
--     golf.golf_courses）は facility_id を keep へ更新する。
--   * keep の欠損カラムは drop の値で補完（住所・座標・種別等）。status は verified を優先。
-- =============================================================

create or replace function facility.merge_facilities(p_keep uuid, p_drop uuid)
returns void
language plpgsql
security definer
set search_path = facility, core, golf, running, outdoor, public
as $$
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

  -- 1) keep の欠損カラムを drop の値で補完（非破壊で情報を寄せる）。
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
    -- どちらかが verified なら verified を優先（公開可能な状態を維持）。
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

  -- facility_reviews: unique(facility_id,user_id)。keep に同一ユーザのレビューが無い分だけ移す。
  update facility.facility_reviews r set facility_id = p_keep
    where r.facility_id = p_drop
      and not exists (
        select 1 from facility.facility_reviews k
        where k.facility_id = p_keep and k.user_id = r.user_id
      );

  -- facility_sources: unique(source_type,source_id) where source_id not null。衝突しない分だけ移す。
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

  -- 3) 単純参照：facility_id を keep へ更新。
  update facility.facility_images        set facility_id = p_keep where facility_id = p_drop;
  update facility.facility_submissions   set facility_id = p_keep where facility_id = p_drop;
  update facility.facility_subscriptions set facility_id = p_keep where facility_id = p_drop;
  update golf.events                     set facility_id = p_keep where facility_id = p_drop;
  update golf.reservations               set facility_id = p_keep where facility_id = p_drop;
  update golf.golf_courses               set facility_id = p_keep where facility_id = p_drop;
  update running.events                  set facility_id = p_keep where facility_id = p_drop;
  update outdoor.events                  set facility_id = p_keep where facility_id = p_drop;

  -- 4) 重複側を削除（残った子行は ON DELETE CASCADE で消える）。
  delete from facility.facilities where id = p_drop;
end;
$$;

revoke all on function facility.merge_facilities(uuid, uuid) from public;
grant execute on function facility.merge_facilities(uuid, uuid) to service_role;
