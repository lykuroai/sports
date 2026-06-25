-- =============================================================
-- 0030 running.races に開催日（event_date）と同期時刻（last_synced_at）を追加
-- 定期バッチ（公式API/許諾フィード）で「開催日が未来日」の大会を取得し、
-- (source, source_id) をキーに新規追加/既存更新（upsert）するための列。
-- 既存の Wikipedia 由来データは event_date が無いので null のまま（過去/将来不明）。
-- =============================================================

alter table running.races
  add column if not exists event_date     date,
  add column if not exists last_synced_at timestamptz;

-- 未来日の大会を素早く引くための索引（開催日順の一覧・絞り込み用）。
create index if not exists running_races_event_date_idx
  on running.races (event_date) where event_date is not null;
