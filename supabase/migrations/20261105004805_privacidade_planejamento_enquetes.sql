-- A relação só é compartilhável quando os públicos coincidem.
create function private.protect_task_link() returns trigger
language plpgsql security definer set search_path='' as $$
declare target public.tasks;
begin
  if new.task_id is null then return new; end if;
  select * into target from public.tasks where id=new.task_id for share;
  if not found or (auth.uid() is not null and
      (tg_op='INSERT' or new.task_id is distinct from old.task_id) and not private.task_visible(new.task_id)) then
    if tg_table_name='events' then raise exception 'TASK_NOT_FOUND'; end if;
    raise exception 'INVALID_REFERENCE';
  end if;
  if tg_table_name='notes' then
    if new.calendar_id is not null and
      (new.calendar_id is distinct from target.calendar_id or target.privacy <> 'members') then
      raise exception 'INVALID_REFERENCE';
    end if;
  elsif target.calendar_id is distinct from new.calendar_id or target.privacy <> 'members' then
    new.privacy := 'private';
  end if;
  return new;
end; $$;
revoke all on function private.protect_task_link() from public,anon,authenticated;
create trigger events_protect_task before insert or update on public.events
for each row execute function private.protect_task_link();
create trigger notes_protect_task before insert or update on public.notes
for each row execute function private.protect_task_link();

create function private.restrict_task_links() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.events set privacy='private'
  where task_id=new.id and privacy <> 'private'
    and (calendar_id is distinct from new.calendar_id or new.privacy <> 'members');
  update public.notes set task_id=null where task_id=new.id and calendar_id is not null
    and (calendar_id is distinct from new.calendar_id or new.privacy <> 'members');
  -- Desligar cópias privadas se o dono do bloco/nota perdeu acesso à origem.
  update public.events e set task_id=null
  where e.task_id=new.id and not private.task_access_for(e.created_by,
    (select m.role from public.calendar_members m where m.calendar_id=new.calendar_id and m.user_id=e.created_by and m.status='active'),
    new.calendar_id,new.id,new.created_by,new.assignee_id,new.privacy);
  update public.notes n set task_id=null
  where n.task_id=new.id and not private.task_access_for(n.created_by,
    (select m.role from public.calendar_members m where m.calendar_id=new.calendar_id and m.user_id=n.created_by and m.status='active'),
    new.calendar_id,new.id,new.created_by,new.assignee_id,new.privacy);
  return new;
end; $$;
revoke all on function private.restrict_task_links() from public,anon,authenticated;
create trigger tasks_restrict_links after update of calendar_id,privacy,assignee_id on public.tasks
for each row when (old.calendar_id is distinct from new.calendar_id or old.privacy is distinct from new.privacy or old.assignee_id is distinct from new.assignee_id)
execute function private.restrict_task_links();

update public.events e set privacy='private' from public.tasks t where e.task_id=t.id
  and e.privacy <> 'private' and (t.calendar_id is distinct from e.calendar_id or t.privacy <> 'members');
update public.notes n set task_id=null from public.tasks t where n.task_id=t.id
  and n.calendar_id is not null and (t.calendar_id is distinct from n.calendar_id or t.privacy <> 'members');

create or replace function public.list_polls(p_calendar_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'calendar_id', p.calendar_id, 'title', p.title, 'description', p.description,
    'duration_minutes', p.duration_minutes, 'timezone', p.timezone,
    'status', case when p.status = 'open' and p.closes_at is not null and p.closes_at <= now() then 'closed' else p.status end,
    'closes_at', p.closes_at, 'chosen_option_id', p.chosen_option_id, 'event_id', case when live.id is not null then p.event_id end,
    'meeting', case when live.id is not null then jsonb_build_object('starts_at',live.starts_at,'ends_at',live.ends_at,'status',live.status,'all_day',live.all_day,'start_date',live.start_date,'end_date',live.end_date) end,
    'created_by', p.created_by, 'created_by_name', private.display_name(p.created_by), 'created_at', p.created_at,
    'participants', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id,
        'display_name', private.display_name(x.user_id)) order by x.user_id)
        from public.availability_poll_participants x where x.poll_id = p.id), '[]'::jsonb),
    'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'starts_at', o.starts_at, 'ends_at', o.ends_at,
        'votes', coalesce((select jsonb_agg(jsonb_build_object('user_id', v.user_id, 'answer', v.answer))
                           from public.availability_poll_votes v where v.option_id = o.id), '[]'::jsonb))
        order by o.starts_at)
        from public.availability_poll_options o where o.poll_id = p.id), '[]'::jsonb))
    order by p.created_at desc), '[]'::jsonb)
  from public.availability_polls p
  left join public.events live on live.id=p.event_id and live.calendar_id=p.calendar_id
    and live.deleted_at is null and private.event_access_by_id(live.id)='full'
  where p.calendar_id = p_calendar_id and private.poll_visible(p.id);
$$;
