-- 0017 で core.user_sports を作成した際、authenticated / anon へのテーブル GRANT を
-- 付け忘れていた（schema の default privileges は service_role のみ）。
-- 既存の規約（各 migration が自テーブルに明示 grant）に合わせて付与する。

grant select, insert, update, delete on core.user_sports to authenticated;
grant select on core.user_sports to anon;
grant all on core.user_sports to service_role;
