-- =============================================================
-- 評価・レビューの集計（仕様 §6.10）
--   * user_reviews 登録時に対象ユーザーの総合評価を再計算
--   * 募集が「開催済み(finished)」になった時に主催回数・参加回数を再計算
-- いずれも RLS を跨いで他ユーザーの profiles を更新するため
-- SECURITY DEFINER とする。
-- =============================================================

-- 対象ユーザーの総合評価を全レビューの平均で更新
create or replace function public.recompute_user_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.target_user_id, old.target_user_id);
begin
  update public.profiles p
     set rating = coalesce((
       select round(avg(r.rating)::numeric, 2)
         from public.user_reviews r
        where r.target_user_id = target
     ), 0)
   where p.user_id = target;
  return null;
end;
$$;

create trigger trg_user_reviews_rating
  after insert or update or delete on public.user_reviews
  for each row execute function public.recompute_user_rating();

-- 募集が開催済みになったら、主催者の主催回数と承認済み参加者の参加回数を再計算
create or replace function public.recompute_event_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'finished' and (old.status is distinct from 'finished') then
    -- 主催回数
    update public.profiles p
       set organizer_count = (
         select count(*) from public.recruitments r
          where r.organizer_id = new.organizer_id and r.status = 'finished'
       )
     where p.user_id = new.organizer_id;

    -- 当該募集の承認済み参加者の参加回数
    update public.profiles p
       set participation_count = (
         select count(distinct rp.recruitment_id)
           from public.recruitment_participants rp
           join public.recruitments r on r.id = rp.recruitment_id
          where rp.user_id = p.user_id
            and rp.status in ('approved', 'attended')
            and r.status = 'finished'
       )
     where p.user_id in (
       select user_id from public.recruitment_participants
        where recruitment_id = new.id and status in ('approved', 'attended')
     );
  end if;
  return null;
end;
$$;

create trigger trg_recruitment_counts
  after update of status on public.recruitments
  for each row execute function public.recompute_event_counts();
