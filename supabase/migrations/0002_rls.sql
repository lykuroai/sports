-- =============================================================
-- Row Level Security ポリシー
-- 仕様 §11.1 / §15.3,§15.6,§15.9
--   * 連絡先(users.email/phone)は本人と管理者のみ。
--   * profiles は公開読み取り可、編集は本人のみ。
--   * 募集は公開状態のみ一般公開、下書き/非公開は主催者のみ。
--   * チャットは承認済みメンバーのみ。
-- =============================================================

-- ヘルパー: 現在ユーザーが管理者か
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ヘルパー: 募集のメンバー（主催者 or 承認済み参加者）か
create or replace function public.is_recruitment_member(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.recruitments r where r.id = rid and r.organizer_id = auth.uid())
      or exists (
        select 1 from public.recruitment_participants p
        where p.recruitment_id = rid and p.user_id = auth.uid() and p.status = 'approved'
      );
$$;

-- RLS 有効化
alter table public.users                  enable row level security;
alter table public.user_roles             enable row level security;
alter table public.profiles               enable row level security;
alter table public.sports                 enable row level security;
alter table public.user_sports            enable row level security;
alter table public.facilities             enable row level security;
alter table public.facility_sports        enable row level security;
alter table public.facility_features      enable row level security;
alter table public.facility_images        enable row level security;
alter table public.facility_submissions   enable row level security;
alter table public.facility_owners        enable row level security;
alter table public.recruitments           enable row level security;
alter table public.recruitment_participants enable row level security;
alter table public.chat_rooms             enable row level security;
alter table public.chat_room_members      enable row level security;
alter table public.chat_messages          enable row level security;
alter table public.notifications          enable row level security;
alter table public.user_reviews           enable row level security;
alter table public.facility_reviews       enable row level security;
alter table public.favorites              enable row level security;
alter table public.reports                enable row level security;
alter table public.blocks                 enable row level security;
alter table public.audit_logs             enable row level security;

-- ---------- users（連絡先は本人/管理者のみ） ----------
create policy users_self_select on public.users
  for select using (id = auth.uid() or public.is_admin());
create policy users_self_update on public.users
  for update using (id = auth.uid());

-- ---------- user_roles ----------
create policy roles_self_select on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());
create policy roles_admin_all on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- profiles（公開） ----------
create policy profiles_public_select on public.profiles
  for select using (true);
create policy profiles_self_modify on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profiles_self_insert on public.profiles
  for insert with check (user_id = auth.uid());

-- ---------- sports（公開読み取り / 編集は管理者） ----------
create policy sports_public_select on public.sports
  for select using (status = 'published' or public.is_admin());
create policy sports_admin_write on public.sports
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- user_sports（本人のみ） ----------
create policy user_sports_select on public.user_sports
  for select using (true);
create policy user_sports_modify on public.user_sports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- facilities（公開読み取り / 編集は管理者・運営者） ----------
create policy facilities_public_select on public.facilities
  for select using (deleted_at is null or public.is_admin());
create policy facilities_admin_write on public.facilities
  for all using (public.is_admin()) with check (public.is_admin());
create policy facilities_owner_update on public.facilities
  for update using (
    exists (select 1 from public.facility_owners o
            where o.facility_id = id and o.user_id = auth.uid() and o.status = 'verified')
  );

create policy facility_sports_select on public.facility_sports for select using (true);
create policy facility_features_select on public.facility_features for select using (true);
create policy facility_images_select on public.facility_images
  for select using (status = 'published' or public.is_admin());

-- ---------- facility_submissions（申請者本人 + 管理者） ----------
create policy submissions_insert on public.facility_submissions
  for insert with check (submitted_by = auth.uid());
create policy submissions_select on public.facility_submissions
  for select using (submitted_by = auth.uid() or public.is_admin());
create policy submissions_admin_update on public.facility_submissions
  for update using (public.is_admin()) with check (public.is_admin());

create policy facility_owners_select on public.facility_owners
  for select using (user_id = auth.uid() or public.is_admin());
create policy facility_owners_insert on public.facility_owners
  for insert with check (user_id = auth.uid());

-- ---------- recruitments ----------
-- 公開状態のものは誰でも閲覧。下書き/非公開は主催者と管理者のみ。
create policy recruitments_public_select on public.recruitments
  for select using (
    (visibility = 'public' and status not in ('draft', 'private') and deleted_at is null)
    or organizer_id = auth.uid()
    or public.is_admin()
  );
create policy recruitments_owner_insert on public.recruitments
  for insert with check (organizer_id = auth.uid());
create policy recruitments_owner_update on public.recruitments
  for update using (organizer_id = auth.uid() or public.is_admin());
create policy recruitments_owner_delete on public.recruitments
  for delete using (organizer_id = auth.uid() or public.is_admin());

-- ---------- recruitment_participants ----------
-- 本人・主催者・管理者が閲覧可。申請は本人、承認操作は主催者。
create policy participants_select on public.recruitment_participants
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.recruitments r where r.id = recruitment_id and r.organizer_id = auth.uid())
    or public.is_admin()
  );
create policy participants_apply on public.recruitment_participants
  for insert with check (user_id = auth.uid());
-- 本人キャンセル or 主催者による承認/拒否
create policy participants_update on public.recruitment_participants
  for update using (
    user_id = auth.uid()
    or exists (select 1 from public.recruitments r where r.id = recruitment_id and r.organizer_id = auth.uid())
    or public.is_admin()
  );

-- ---------- chat（承認済みメンバーのみ） ----------
create policy chat_rooms_select on public.chat_rooms
  for select using (public.is_recruitment_member(recruitment_id) or public.is_admin());
create policy chat_members_select on public.chat_room_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.chat_rooms c where c.id = chat_room_id and public.is_recruitment_member(c.recruitment_id))
  );
create policy chat_messages_select on public.chat_messages
  for select using (
    exists (select 1 from public.chat_rooms c where c.id = chat_room_id and public.is_recruitment_member(c.recruitment_id))
  );
create policy chat_messages_insert on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.chat_rooms c where c.id = chat_room_id and public.is_recruitment_member(c.recruitment_id))
  );
create policy chat_messages_update on public.chat_messages
  for update using (sender_id = auth.uid() or public.is_admin());

-- ---------- notifications（本人のみ） ----------
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());

-- ---------- reviews ----------
-- user_reviews: 公開分は誰でも、制限分は当事者と管理者のみ。
create policy user_reviews_select on public.user_reviews
  for select using (
    visibility = 'public'
    or reviewer_id = auth.uid() or target_user_id = auth.uid()
    or public.is_admin()
  );
create policy user_reviews_insert on public.user_reviews
  for insert with check (reviewer_id = auth.uid());

create policy facility_reviews_select on public.facility_reviews
  for select using (status = 'published' or user_id = auth.uid() or public.is_admin());
create policy facility_reviews_insert on public.facility_reviews
  for insert with check (user_id = auth.uid());

-- ---------- favorites / blocks（本人のみ） ----------
create policy favorites_all on public.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy blocks_all on public.blocks
  for all using (blocker_user_id = auth.uid()) with check (blocker_user_id = auth.uid());

-- ---------- reports（申請は本人、閲覧は本人/管理者） ----------
create policy reports_insert on public.reports
  for insert with check (reporter_id = auth.uid());
create policy reports_select on public.reports
  for select using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin_update on public.reports
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- audit_logs（管理者のみ） ----------
create policy audit_admin_select on public.audit_logs
  for select using (public.is_admin());
