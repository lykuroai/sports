-- 共通プロフィールのアバター画像用 Storage バケット。
-- 公開読み取り可（プロフィールは account.profiles.RLS で全公開のため画像も公開）。
-- 書き込み・更新・削除は本人のフォルダ（avatars/<uid>/...）のみに限定する。

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 公開読み取り
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- 本人フォルダのみ書き込み可（パス先頭セグメント = 自分の uid）
create policy "avatars_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
