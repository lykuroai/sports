-- =============================================================
-- 0014 相互評価(running/outdoor)・お気に入り・フォロー
-- 評価の総合値(account.profiles.rating)は種目横断で集計する（設計方針）。
-- =============================================================

-- ---- running/outdoor の相互評価テーブル（golf 0011 と同型）----
do $$
declare s text;
begin
  foreach s in array array['running','outdoor'] loop
    execute format($f$
      create table %I.user_reviews (
        id          uuid primary key default uuid_generate_v4(),
        event_id    uuid not null references %I.events (id) on delete cascade,
        reviewer_id uuid not null references account.users (id) on delete cascade,
        reviewee_id uuid not null references account.users (id) on delete cascade,
        rating      int not null check (rating between 1 and 5),
        tags        text[],
        comment     text,
        visibility  review_visibility not null default 'restricted',
        created_at  timestamptz not null default now(),
        unique (event_id, reviewer_id, reviewee_id)
      )
    $f$, s, s);
    execute format('alter table %I.user_reviews enable row level security', s);
    execute format('create policy %I_review_insert on %I.user_reviews for insert with check (reviewer_id = auth.uid() and %I.is_event_member(event_id))', s, s, s);
    execute format($f$create policy %I_review_select on %I.user_reviews for select using (visibility = 'public' or reviewer_id = auth.uid() or reviewee_id = auth.uid() or core.is_admin())$f$, s, s);
    execute format('grant select, insert, update, delete on %I.user_reviews to authenticated', s);
    execute format('grant all on %I.user_reviews to service_role', s);
  end loop;
end $$;

-- ---- 種目横断の総合評価集計（全種目の user_reviews を union）----
-- 新種目を追加したら、この関数に union を1行足すこと。
create or replace function core.recalc_user_rating(uid uuid)
returns void language plpgsql security definer set search_path = core, account, golf, running, outdoor, public as $$
declare avg_rating numeric;
begin
  select coalesce(avg(rating), 0) into avg_rating from (
    select rating from golf.user_reviews    where reviewee_id = uid
    union all
    select rating from running.user_reviews where reviewee_id = uid
    union all
    select rating from outdoor.user_reviews where reviewee_id = uid
  ) all_reviews;
  update account.profiles set rating = round(avg_rating, 2), updated_at = now() where user_id = uid;
end;
$$;

-- golf の旧トリガー（golf 単独集計）を core 集計へ差し替え
drop trigger if exists golf_review_recalc on golf.user_reviews;
drop function if exists golf.recalc_reviewee_rating();

create or replace function core.review_recalc_trigger()
returns trigger language plpgsql security definer set search_path = core, public as $$
begin
  perform core.recalc_user_rating(new.reviewee_id);
  return new;
end;
$$;

create trigger golf_review_recalc    after insert or update on golf.user_reviews    for each row execute function core.review_recalc_trigger();
create trigger running_review_recalc after insert or update on running.user_reviews for each row execute function core.review_recalc_trigger();
create trigger outdoor_review_recalc after insert or update on outdoor.user_reviews for each row execute function core.review_recalc_trigger();

-- ---- お気に入り（種目横断・募集/施設/主催者/エリア等）----
create table core.favorites (
  user_id     uuid not null references account.users (id) on delete cascade,
  target_type favorite_target not null,
  target_id   text not null,
  domain      text,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
alter table core.favorites enable row level security;
create policy favorites_self on core.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- 主催者フォロー ----
create table core.follows (
  follower_id uuid not null references account.users (id) on delete cascade,
  followee_id uuid not null references account.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id)
);
alter table core.follows enable row level security;
create policy follows_self on core.follows
  for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy follows_visible on core.follows
  for select using (follower_id = auth.uid() or followee_id = auth.uid());

grant select, insert, update, delete on core.favorites, core.follows to authenticated;
grant all on core.favorites, core.follows to service_role;
