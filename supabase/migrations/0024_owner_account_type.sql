-- =============================================================
-- 0024_owner_account_type.sql
-- 施設運営者の「別アカウント体系」A案：同一 Supabase Auth を共用しつつ、
-- アカウント種別 (account_type) で「一般」「施設運営者」を分離する。
--   - 施設運営者は facility アプリ専用で登録し、一般プロフィール(account.profiles)を持たない。
--   - 既存ユーザは 'general' のまま（非破壊・ロックアウト防止）。既存オーナーは当面は
--     dual-use のままで、必要なら後で個別に種別変更する。
-- =============================================================

-- 1. account_type 列（'general' | 'facility_owner'）。
alter table account.users
  add column account_type text not null default 'general';
alter table account.users
  add constraint account_users_account_type_check
  check (account_type in ('general', 'facility_owner'));

-- 2. 新規 auth.users → account.users/profiles 生成トリガーを種別対応に作り直す。
--    raw_user_meta_data.account_type='facility_owner' のときは:
--      - account.users.account_type を facility_owner にする
--      - 一般プロフィール account.profiles は作らない（運営者は一般プロフィール非保持）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = account, public as $$
declare
  v_account_type text := coalesce(new.raw_user_meta_data ->> 'account_type', 'general');
begin
  if v_account_type not in ('general', 'facility_owner') then
    v_account_type := 'general';
  end if;

  insert into account.users (id, email, phone, email_verified_at, phone_verified_at, account_type)
    values (new.id, new.email, new.phone, new.email_confirmed_at, new.phone_confirmed_at, v_account_type)
    on conflict (id) do update
      set email = excluded.email,
          phone = excluded.phone,
          email_verified_at = coalesce(account.users.email_verified_at, excluded.email_verified_at),
          phone_verified_at = coalesce(account.users.phone_verified_at, excluded.phone_verified_at);

  -- 施設運営者は一般プロフィールを持たない。
  if v_account_type = 'general' then
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
  end if;

  return new;
end;
$$;

-- トリガー本体は 0015 で貼り済み（関数を置き換えるだけで反映される）。
