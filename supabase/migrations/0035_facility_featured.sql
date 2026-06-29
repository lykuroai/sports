-- =============================================================
-- 0035 おすすめ施設（管理画面で指定）
-- 根拠: 依頼「HOME のおすすめ施設を管理画面で指定するようにする」。
--   従来 HOME は「最新登録の verified 施設6件」を自動表示していたが、運営が任意に
--   選んだ施設を出せるよう facilities に featured_rank を追加する。
--
--   featured_rank: null=おすすめでない / 数値=おすすめ（昇順で上位に表示）。
--   公開側(web)は RLS の facilities select(=true) でそのまま読める。設定は管理画面が
--   サービスロールで更新（audit_logs 記録）。
-- =============================================================

alter table facility.facilities
  add column if not exists featured_rank int;

-- おすすめ施設の取得（featured_rank not null を昇順）を効率化。
create index if not exists facilities_featured_rank_idx
  on facility.facilities (featured_rank)
  where featured_rank is not null;
