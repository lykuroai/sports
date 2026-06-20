-- =============================================================
-- 0021_golf_member_visibility.sql
-- ゴルフイベントの承認済みメンバー同士で参加者情報を相互公開する。
--
-- 背景: 0011 の golf_part_select は「本人・主催者・管理者」のみが
-- event_participants を読めた。承認済み参加者が他のメンバー（発起者・
-- 他の承認済み参加者）を確認し、チャットで誰の発言かを把握できるよう、
-- 「承認済みメンバーが同じイベントの承認済み参加者行を読める」ケースを追加する。
--
-- 公開されるのは公開情報（ニックネーム・評価・公開プロフィール）のみ。
-- メール・電話・本名は account 側の非公開テーブルに分離されており、本変更の
-- 対象外（プライバシー原則 §6.1/§15.6 を維持）。golf 種目のみに適用。
-- =============================================================

drop policy if exists golf_part_select on golf.event_participants;
create policy golf_part_select on golf.event_participants
  for select using (
    user_id = auth.uid()
    or exists (select 1 from golf.events e where e.id = event_id and e.organizer_id = auth.uid())
    or core.is_admin()
    -- 承認済みメンバーは同じイベントの承認済み参加者を閲覧できる
    or (status = 'approved' and golf.is_event_member(event_id))
  );
