-- =============================================================
-- 0015 新規 auth.users → account.users + account.profiles 自動生成（スキーマ分離対応）
--
-- 0001 の handle_new_user は public.users/profiles を対象にしていたが、0009 でそれらを
-- drop したため壊れていた。account スキーマを対象に作り直す。これにより
-- メール/Google/Apple/LINE/電話 いずれの新規登録でも account 行が生成される。
-- =============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = account, public as $$
begin
  insert into account.users (id, email, phone, email_verified_at, phone_verified_at)
    values (new.id, new.email, new.phone, new.email_confirmed_at, new.phone_confirmed_at)
    on conflict (id) do update
      set email = excluded.email,
          phone = excluded.phone,
          email_verified_at = coalesce(account.users.email_verified_at, excluded.email_verified_at),
          phone_verified_at = coalesce(account.users.phone_verified_at, excluded.phone_verified_at);

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

  return new;
end;
$$;

-- トリガーが消えていた場合に備えて貼り直す
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- メール確認/電話確認の後追い反映（任意・確認タイムスタンプ同期）
create or replace function public.handle_user_updated()
returns trigger language plpgsql security definer set search_path = account, public as $$
begin
  update account.users
    set email = new.email,
        phone = new.phone,
        email_verified_at = new.email_confirmed_at,
        phone_verified_at = new.phone_confirmed_at,
        updated_at = now()
    where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_updated();
