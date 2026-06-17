-- =============================================================
-- 管理者向けポリシー（仕様 §7.4 / §11.1）
-- アプリの管理操作は基本的にサービスロール経由で行うが、
-- セッションクライアントから管理者が操作する場合に備えて
-- 防御的に admin の更新ポリシーを追加する。
-- =============================================================

-- 管理者は利用者アカウントの状態（停止/復帰）を更新できる
create policy users_admin_update on public.users
  for update using (public.is_admin()) with check (public.is_admin());

-- 管理者はプロフィールを更新できる（なりすまし対応・不適切情報の修正）
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- 管理者は施設レビューを更新できる（非公開化）
create policy facility_reviews_admin_update on public.facility_reviews
  for update using (public.is_admin()) with check (public.is_admin());

-- 管理者は監査ログを記録できる
create policy audit_admin_insert on public.audit_logs
  for insert with check (public.is_admin());

-- =============================================================
-- 管理者の付与（手動）:
--   insert into public.user_roles (user_id, role)
--   values ('<auth.users.id>', 'admin');
-- =============================================================
