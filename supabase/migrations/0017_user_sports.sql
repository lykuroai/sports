-- 利用者の取り組む種目と自己申告レベル（種目横断の共通プロフィール）。
-- スキーマ分割（0009）で public.user_sports を drop したまま未再定義だったため core に再作成する。
-- 仕様 §8.4（users / profiles / user_sports）。

create table if not exists core.user_sports (
  user_id          uuid not null references account.users (id) on delete cascade,
  sport_id         uuid not null references core.sports (id) on delete cascade,
  skill_level      skill_level not null default 'beginner',
  experience_years int,
  is_favorite      boolean not null default false,
  primary key (user_id, sport_id)
);

alter table core.user_sports enable row level security;

-- 公開読み取り（公開プロフィールで「取り組む種目・レベル」を表示するため）。
create policy user_sports_public_select on core.user_sports
  for select using (true);

-- 追加・変更・削除は本人のみ。
create policy user_sports_self_modify on core.user_sports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- テーブル GRANT（schema の default privileges は service_role のみのため明示付与）。
grant select, insert, update, delete on core.user_sports to authenticated;
grant select on core.user_sports to anon;
grant all on core.user_sports to service_role;
