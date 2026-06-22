-- 施設運営者の申請→承認フロー。
-- facility_owners に申請メタ（根拠URL・備考・申請/審査日時・審査者）を追加し、
-- 利用者が自分の pending 申請を作成できる RLS を足す。承認は管理者がサービスロールで実行。

alter table facility.facility_owners
  add column if not exists note         text,
  add column if not exists evidence_url text,
  add column if not exists created_at   timestamptz not null default now(),
  add column if not exists reviewed_by  uuid references account.users (id),
  add column if not exists reviewed_at  timestamptz;

-- 利用者は自分の申請（pending）のみ作成できる。
create policy fac_owner_self_apply on facility.facility_owners
  for insert with check (user_id = auth.uid() and status = 'pending');

-- 利用者は自分の pending 申請を取り下げ（削除）できる。
create policy fac_owner_self_withdraw on facility.facility_owners
  for delete using (user_id = auth.uid() and status = 'pending');
