-- =============================================================
-- 0022_backfill_chat_rooms.sql
-- 既存イベントの欠落グループチャットを補完する。
--
-- 背景: createSportEvent はイベント作成時に chat_rooms / chat_room_members を
-- 「セッションクライアント」で insert していたが、これらのテーブルには INSERT 用の
-- RLS ポリシーが無いため挿入が拒否され、チャットルームが作られていなかった
-- （「グループチャットを開く」で notFound になる原因）。アプリ側はサービスロールで
-- 作成するよう修正済み。本マイグレーションは修正前に作成された既存イベント分の
-- ルームと、主催者・承認済み参加者のメンバー登録をまとめて補完する。
--
-- golf / running / outdoor の3スキーマに同一処理を適用する。
-- =============================================================

do $$
declare
  s text;
begin
  foreach s in array array['golf', 'running', 'outdoor'] loop
    -- 1) ルームが無いイベントにルームを作成
    execute format($f$
      insert into %1$I.chat_rooms (event_id)
      select e.id from %1$I.events e
      where not exists (select 1 from %1$I.chat_rooms r where r.event_id = e.id)
    $f$, s);

    -- 2) 主催者のメンバー登録（未登録のみ）
    execute format($f$
      insert into %1$I.chat_room_members (chat_room_id, user_id, role)
      select r.id, e.organizer_id, 'organizer'
      from %1$I.chat_rooms r
      join %1$I.events e on e.id = r.event_id
      where not exists (
        select 1 from %1$I.chat_room_members m
        where m.chat_room_id = r.id and m.user_id = e.organizer_id
      )
    $f$, s);

    -- 3) 承認済み参加者のメンバー登録（未登録のみ）
    execute format($f$
      insert into %1$I.chat_room_members (chat_room_id, user_id, role)
      select r.id, p.user_id, 'participant'
      from %1$I.chat_rooms r
      join %1$I.event_participants p on p.event_id = r.event_id and p.status = 'approved'
      where not exists (
        select 1 from %1$I.chat_room_members m
        where m.chat_room_id = r.id and m.user_id = p.user_id
      )
    $f$, s);
  end loop;
end $$;
