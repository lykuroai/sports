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
