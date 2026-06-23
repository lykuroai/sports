-- 本人確認書類用の Storage バケット（非公開）。
-- アバター（0016, 公開）と異なり、本人確認書類は機微情報のため公開読み取りを付けない。
-- 書き込みは本人フォルダ（verification-docs/<uid>/...）のみ。閲覧は本人のみ（RLS）で、
-- 管理者の審査閲覧はアプリ側でサービスロールの署名URLを発行して行う（RLS に admin は足さない）。

insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

-- 本人フォルダのみ書き込み可（パス先頭セグメント = 自分の uid）
create policy "verifdocs_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 本人のみ読み取り可
create policy "verifdocs_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 本人のみ削除可（再申請時の差し替え）
create policy "verifdocs_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
