-- =============================================================
-- PostgREST 埋め込み用に、利用者参照カラムの外部キーを
-- public.users(id) から public.profiles(user_id) へ張り替える。
--
-- 理由: アプリは `profiles:organizer_id(...)` のように「列名の外部キー先」を
-- 埋め込む。元の FK は users を指すため display_name 等が引けなかった。
-- profiles.user_id は users(id) を参照する一意キーのため、profiles 経由でも
-- users への整合性は担保される（profiles はサインアップ時にトリガーで自動生成）。
-- =============================================================

-- recruitments.organizer_id
alter table public.recruitments drop constraint if exists recruitments_organizer_id_fkey;
alter table public.recruitments add constraint recruitments_organizer_id_fkey
  foreign key (organizer_id) references public.profiles (user_id) on delete cascade;

-- recruitment_participants.user_id
alter table public.recruitment_participants drop constraint if exists recruitment_participants_user_id_fkey;
alter table public.recruitment_participants add constraint recruitment_participants_user_id_fkey
  foreign key (user_id) references public.profiles (user_id) on delete cascade;

-- chat_messages.sender_id
alter table public.chat_messages drop constraint if exists chat_messages_sender_id_fkey;
alter table public.chat_messages add constraint chat_messages_sender_id_fkey
  foreign key (sender_id) references public.profiles (user_id) on delete set null;

-- facility_reviews.user_id
alter table public.facility_reviews drop constraint if exists facility_reviews_user_id_fkey;
alter table public.facility_reviews add constraint facility_reviews_user_id_fkey
  foreign key (user_id) references public.profiles (user_id) on delete cascade;

-- blocks.blocked_user_id
alter table public.blocks drop constraint if exists blocks_blocked_user_id_fkey;
alter table public.blocks add constraint blocks_blocked_user_id_fkey
  foreign key (blocked_user_id) references public.profiles (user_id) on delete cascade;

-- user_reviews（将来の埋め込みに備えて reviewer/target も揃える）
alter table public.user_reviews drop constraint if exists user_reviews_reviewer_id_fkey;
alter table public.user_reviews add constraint user_reviews_reviewer_id_fkey
  foreign key (reviewer_id) references public.profiles (user_id) on delete cascade;
alter table public.user_reviews drop constraint if exists user_reviews_target_user_id_fkey;
alter table public.user_reviews add constraint user_reviews_target_user_id_fkey
  foreign key (target_user_id) references public.profiles (user_id) on delete cascade;
