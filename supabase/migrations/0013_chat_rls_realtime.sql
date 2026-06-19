-- =============================================================
-- 0013 running/outdoor のチャット RLS（golf と同型）＋ Realtime publication
-- 0012 では chat_* で RLS を有効化したがポリシー未作成（=全拒否）だった。golf 相当を付与。
-- =============================================================

do $$
declare s text;
begin
  foreach s in array array['running','outdoor'] loop
    -- is_event_member(eid)
    execute format($f$
      create or replace function %I.is_event_member(eid uuid)
      returns boolean language sql stable security definer set search_path = %I, public as $body$
        select exists (select 1 from %I.events e where e.id = eid and e.organizer_id = auth.uid())
            or exists (
              select 1 from %I.event_participants p
              where p.event_id = eid and p.user_id = auth.uid() and p.status = 'approved'
            );
      $body$;
    $f$, s, s, s, s);

    execute format('create policy %I_room_select on %I.chat_rooms for select using (%I.is_event_member(event_id))', s, s, s);
    execute format('create policy %I_member_select on %I.chat_room_members for select using (%I.is_event_member((select event_id from %I.chat_rooms r where r.id = chat_room_id)))', s, s, s, s);
    execute format('create policy %I_msg_select on %I.chat_messages for select using (%I.is_event_member((select event_id from %I.chat_rooms r where r.id = chat_room_id)))', s, s, s, s);
    execute format('create policy %I_msg_insert on %I.chat_messages for insert with check (sender_id = auth.uid() and %I.is_event_member((select event_id from %I.chat_rooms r where r.id = chat_room_id)))', s, s, s, s);
  end loop;
end $$;

-- Realtime publication（グループチャットの新着メッセージ購読用）
alter publication supabase_realtime add table golf.chat_messages;
alter publication supabase_realtime add table running.chat_messages;
alter publication supabase_realtime add table outdoor.chat_messages;
