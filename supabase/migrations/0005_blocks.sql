-- =============================================================
-- ブロック判定（仕様 §6.11）
-- RLS では自分が作成したブロック行しか読めないため、双方向の
-- ブロック有無を判定する SECURITY DEFINER 関数を用意する。
-- =============================================================
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
     where (blocker_user_id = a and blocked_user_id = b)
        or (blocker_user_id = b and blocked_user_id = a)
  );
$$;
