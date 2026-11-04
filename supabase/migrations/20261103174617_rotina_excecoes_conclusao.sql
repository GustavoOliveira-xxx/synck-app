-- Exceções privadas por data e controle de concorrência da rotina.
create function public.save_my_routine(p_periods jsonb, p_expected jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.user_preferences set routine_periods=p_periods
  where user_id=auth.uid() and routine_periods=p_expected;
  if not found then raise exception 'ROUTINE_CHANGED'; end if;
end; $$;
revoke all on function public.save_my_routine(jsonb,jsonb) from public,anon;
grant execute on function public.save_my_routine(jsonb,jsonb) to authenticated;

create function private.validate_routine_exceptions()
returns trigger language plpgsql set search_path='' as $$
declare p jsonb; e jsonb; a timestamptz; b timestamptz;
begin
  for p in select value from jsonb_array_elements(new.routine_periods) loop
    if p ? 'exceptions' then
      if jsonb_typeof(p->'exceptions') <> 'array' or jsonb_array_length(p->'exceptions')>730 then raise exception 'INVALID_ROUTINE_EXCEPTION'; end if;
      if (select count(distinct x->>'original_date') from jsonb_array_elements(p->'exceptions') x)<>jsonb_array_length(p->'exceptions') then raise exception 'INVALID_ROUTINE_EXCEPTION'; end if;
      for e in select value from jsonb_array_elements(p->'exceptions') loop
        if not coalesce(jsonb_typeof(e)='object' and e->>'original_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and e->>'action' in ('skip','move'),false) then raise exception 'INVALID_ROUTINE_EXCEPTION'; end if;
        perform (e->>'original_date')::date;
        if e->>'action'='skip' then
          if e ? 'starts_at' or e ? 'ends_at' then raise exception 'INVALID_ROUTINE_EXCEPTION'; end if;
        else
          if not coalesce(e->>'starts_at' ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' and e->>'ends_at' ~ '(Z|[+-][0-9]{2}:[0-9]{2})$',false) then raise exception 'INVALID_ROUTINE_EXCEPTION'; end if;
          a:=(e->>'starts_at')::timestamptz; b:=(e->>'ends_at')::timestamptz;
          if not isfinite(a) or not isfinite(b) or b<=a or b-a>interval '2 days' then raise exception 'INVALID_ROUTINE_EXCEPTION'; end if;
        end if;
      end loop;
    end if;
  end loop;
  return new;
end; $$;
revoke all on function private.validate_routine_exceptions() from public,anon;
create trigger user_routine_exceptions_validate before insert or update of routine_periods on public.user_preferences for each row execute function private.validate_routine_exceptions();

alter table public.recurrence_exceptions add column status text check(status in ('planned','completed'));
grant insert(status),update(status) on public.recurrence_exceptions to authenticated;

create or replace function public.apply_event_op(
  p_op_id uuid, p_kind text, p_event_id uuid, p_payload jsonb default '{}'::jsonb,
  p_base_version integer default null, p_origin text default 'app')
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_prev jsonb;
  v_result jsonb;
  v_row public.events;
  v_current public.events;
  v_new public.events;
  v_exc public.recurrence_exceptions;
  v_origin text := case when p_origin = 'offline_sync' then 'offline_sync' else 'app' end;
  v_p jsonb := coalesce(p_payload, '{}'::jsonb);
  v_n jsonb;
begin
  if p_op_id is null or p_event_id is null then
    raise exception 'INVALID_OPERATION' using errcode = 'P0001';
  end if;

  select s.result into v_prev from public.sync_operations s where s.id = p_op_id and s.user_id = v_uid;
  if v_prev is not null then
    return v_prev || jsonb_build_object('replayed', true);
  end if;

  begin
    if p_kind = 'create' then
      insert into public.events (id, calendar_id, title, description, location, address, url, all_day,
        starts_at, ends_at, start_date, end_date, timezone, recurrence_rule, assignee_id, color,
        event_type, status, privacy, change_origin, task_id, external_uid, decoration)
      values (p_event_id, (v_p ->> 'calendar_id')::uuid, v_p ->> 'title', v_p ->> 'description',
        v_p ->> 'location', v_p ->> 'address', v_p ->> 'url', coalesce((v_p ->> 'all_day')::boolean, false),
        (v_p ->> 'starts_at')::timestamptz, (v_p ->> 'ends_at')::timestamptz,
        (v_p ->> 'start_date')::date, (v_p ->> 'end_date')::date,
        coalesce(v_p ->> 'timezone', 'America/Sao_Paulo'), v_p ->> 'recurrence_rule',
        (v_p ->> 'assignee_id')::uuid, v_p ->> 'color',
        coalesce(v_p ->> 'event_type', 'appointment'), coalesce(v_p ->> 'status', 'planned'),
        coalesce(v_p ->> 'privacy', 'members'), v_origin, (v_p ->> 'task_id')::uuid, v_p ->> 'external_uid', v_p ->> 'decoration')
      on conflict (id) do nothing
      returning * into v_row;

      if v_row.id is null then
        select * into v_current from public.events e where e.id = p_event_id;
        if v_current.id is not null and v_current.created_by = v_uid then
          v_result := jsonb_build_object('status', 'ok', 'event', to_jsonb(v_current));
        else
          v_result := jsonb_build_object('status', 'error', 'code', 'DUPLICATE_ID');
        end if;
      else
        v_result := jsonb_build_object('status', 'ok', 'event', to_jsonb(v_row));
      end if;

    elsif p_kind in ('update', 'delete', 'restore', 'split_series') then
      if p_kind = 'update' then
        update public.events e set
          decoration = case when v_p ? 'decoration' then v_p ->> 'decoration' else e.decoration end,
          title = case when v_p ? 'title' then v_p ->> 'title' else e.title end,
          description = case when v_p ? 'description' then v_p ->> 'description' else e.description end,
          location = case when v_p ? 'location' then v_p ->> 'location' else e.location end,
          address = case when v_p ? 'address' then v_p ->> 'address' else e.address end,
          url = case when v_p ? 'url' then v_p ->> 'url' else e.url end,
          all_day = case when v_p ? 'all_day' then (v_p ->> 'all_day')::boolean else e.all_day end,
          starts_at = case when v_p ? 'starts_at' then (v_p ->> 'starts_at')::timestamptz else e.starts_at end,
          ends_at = case when v_p ? 'ends_at' then (v_p ->> 'ends_at')::timestamptz else e.ends_at end,
          start_date = case when v_p ? 'start_date' then (v_p ->> 'start_date')::date else e.start_date end,
          end_date = case when v_p ? 'end_date' then (v_p ->> 'end_date')::date else e.end_date end,
          timezone = case when v_p ? 'timezone' then v_p ->> 'timezone' else e.timezone end,
          recurrence_rule = case when v_p ? 'recurrence_rule' then v_p ->> 'recurrence_rule' else e.recurrence_rule end,
          assignee_id = case when v_p ? 'assignee_id' then (v_p ->> 'assignee_id')::uuid else e.assignee_id end,
          color = case when v_p ? 'color' then v_p ->> 'color' else e.color end,
          event_type = case when v_p ? 'event_type' then v_p ->> 'event_type' else e.event_type end,
          status = case when v_p ? 'status' then v_p ->> 'status' else e.status end,
          privacy = case when v_p ? 'privacy' then v_p ->> 'privacy' else e.privacy end,
          task_id = case when v_p ? 'task_id' then (v_p ->> 'task_id')::uuid else e.task_id end,
          change_origin = v_origin
        where e.id = p_event_id and e.version = p_base_version and e.deleted_at is null
        returning * into v_row;
      elsif p_kind = 'delete' then
        update public.events e set deleted_at = now(), change_origin = v_origin
        where e.id = p_event_id and (p_base_version is null or e.version = p_base_version) and e.deleted_at is null
        returning * into v_row;
      elsif p_kind = 'restore' then
        update public.events e set deleted_at = null, change_origin = v_origin
        where e.id = p_event_id and e.deleted_at is not null
        returning * into v_row;
      else
        update public.events e set recurrence_rule = v_p ->> 'original_rule', change_origin = v_origin
        where e.id = p_event_id and e.version = p_base_version and e.deleted_at is null
          and e.recurrence_rule is not null
        returning * into v_row;
        if v_row.id is not null then
          v_n := v_p -> 'new_event';
          insert into public.events (id, calendar_id, title, description, location, address, url, all_day,
            starts_at, ends_at, start_date, end_date, timezone, recurrence_rule, assignee_id, color,
            event_type, status, privacy, change_origin, task_id, decoration)
          values ((v_n ->> 'id')::uuid, v_row.calendar_id, v_n ->> 'title', v_n ->> 'description',
            v_n ->> 'location', v_n ->> 'address', v_n ->> 'url', coalesce((v_n ->> 'all_day')::boolean, false),
            (v_n ->> 'starts_at')::timestamptz, (v_n ->> 'ends_at')::timestamptz,
            (v_n ->> 'start_date')::date, (v_n ->> 'end_date')::date,
            coalesce(v_n ->> 'timezone', v_row.timezone), v_n ->> 'recurrence_rule',
            (v_n ->> 'assignee_id')::uuid, v_n ->> 'color',
            coalesce(v_n ->> 'event_type', v_row.event_type), coalesce(v_n ->> 'status', v_row.status),
            coalesce(v_n ->> 'privacy', v_row.privacy), v_origin, v_row.task_id, v_n ->> 'decoration')
          returning * into v_new;
        end if;
      end if;

      if v_row.id is not null then
        v_result := jsonb_build_object('status', 'ok', 'event', to_jsonb(v_row));
        if v_new.id is not null then
          v_result := v_result || jsonb_build_object('new_event', to_jsonb(v_new));
        end if;
      else
        select * into v_current from public.events e where e.id = p_event_id;
        if v_current.id is null then
          v_result := jsonb_build_object('status', 'error', 'code', 'NOT_FOUND');
        elsif p_kind = 'delete' and v_current.deleted_at is not null then
          v_result := jsonb_build_object('status', 'ok', 'event', to_jsonb(v_current));
        elsif p_kind = 'restore' and v_current.deleted_at is null then
          v_result := jsonb_build_object('status', 'ok', 'event', to_jsonb(v_current));
        elsif v_current.deleted_at is not null then
          v_result := jsonb_build_object('status', 'conflict', 'reason', 'deleted', 'event', to_jsonb(v_current));
        elsif p_base_version is not null and v_current.version <> p_base_version then
          v_result := jsonb_build_object('status', 'conflict', 'reason', 'version', 'event', to_jsonb(v_current));
        else
          v_result := jsonb_build_object('status', 'error', 'code', 'FORBIDDEN');
        end if;
      end if;

    elsif p_kind = 'exception_upsert' then
      insert into public.recurrence_exceptions (event_id, original_date, is_cancelled, title, description,
        location, starts_at, ends_at, status)
      values (p_event_id, (v_p ->> 'original_date')::date, coalesce((v_p ->> 'is_cancelled')::boolean, false),
        v_p ->> 'title', v_p ->> 'description', v_p ->> 'location',
        (v_p ->> 'starts_at')::timestamptz, (v_p ->> 'ends_at')::timestamptz, v_p ->> 'status')
      on conflict (event_id, original_date) do update set
        is_cancelled = excluded.is_cancelled,
        title = excluded.title,
        description = excluded.description,
        location = excluded.location,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        status = case when v_p ? 'status' then excluded.status else public.recurrence_exceptions.status end
      returning * into v_exc;
      v_result := jsonb_build_object('status', 'ok', 'exception', to_jsonb(v_exc));

    elsif p_kind = 'exception_delete' then
      delete from public.recurrence_exceptions x
       where x.event_id = p_event_id and x.original_date = (v_p ->> 'original_date')::date;
      v_result := jsonb_build_object('status', 'ok');

    else
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_OPERATION');
    end if;
  exception
    when insufficient_privilege then
      v_result := jsonb_build_object('status', 'error', 'code', 'FORBIDDEN');
    when check_violation or not_null_violation or invalid_text_representation
         or invalid_datetime_format or datetime_field_overflow or string_data_right_truncation then
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_DATA');
    when foreign_key_violation then
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_REFERENCE');
    when unique_violation then
      v_result := jsonb_build_object('status', 'error', 'code', 'DUPLICATE_ID');
    when raise_exception then
      v_result := jsonb_build_object('status', 'error', 'code', sqlerrm);
  end;

  if v_result ->> 'status' in ('ok', 'error') then
    insert into public.sync_operations (id, user_id, kind, entity_id, result)
    values (p_op_id, v_uid, p_kind, p_event_id, jsonb_strip_nulls(jsonb_build_object(
      'status', v_result ->> 'status',
      'code', v_result ->> 'code',
      'event_id', p_event_id,
      'version', (v_result -> 'event' ->> 'version')::integer)))
    on conflict (id) do nothing;
  end if;

  return v_result;
end;
$$;

create or replace function public.list_events(p_calendar_ids uuid[], p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, calendar_id uuid, title text, description text, location text, address text, url text,
  all_day boolean, starts_at timestamptz, ends_at timestamptz, start_date date, end_date date,
  timezone text, recurrence_rule text, created_by uuid, assignee_id uuid, color text,
  event_type text, status text, privacy text, version integer, created_at timestamptz,
  updated_at timestamptz, updated_by uuid, completed_at timestamptz, is_masked boolean,
  exceptions jsonb, attendee_ids uuid[], my_reminders integer[], task_id uuid, external_uid text, decoration text)
language sql
stable
security definer
set search_path = ''
as $$
  with my_cals as (
    select m.calendar_id, m.role
    from public.calendar_members m
    join public.calendars c on c.id = m.calendar_id
    where m.user_id = auth.uid() and m.status = 'active' and c.deleted_at is null
      and (p_calendar_ids is null or m.calendar_id = any (p_calendar_ids))
  ),
  visible as (
    select e.*, private.event_access_for(mc.role, auth.uid(), e.id, e.created_by, e.privacy) as access
    from public.events e
    join my_cals mc on mc.calendar_id = e.calendar_id
    where e.deleted_at is null
      and e.starts_at < p_to
      and (e.recurrence_rule is not null or e.ends_at > p_from)
  )
  select v.id, v.calendar_id,
         case when v.access = 'full' then v.title end,
         case when v.access = 'full' then v.description end,
         case when v.access = 'full' then v.location end,
         case when v.access = 'full' then v.address end,
         case when v.access = 'full' then v.url end,
         v.all_day, v.starts_at, v.ends_at, v.start_date, v.end_date, v.timezone, v.recurrence_rule,
         case when v.access = 'full' then v.created_by end,
         case when v.access = 'full' then v.assignee_id end,
         v.color,
         case when v.access = 'full' then v.event_type else 'custom' end,
         v.status, v.privacy, v.version, v.created_at, v.updated_at,
         case when v.access = 'full' then v.updated_by end,
         v.completed_at,
         v.access = 'masked',
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'original_date', x.original_date,
             'is_cancelled', x.is_cancelled,
             'title', case when v.access = 'full' then x.title end,
             'description', case when v.access = 'full' then x.description end,
             'location', case when v.access = 'full' then x.location end,
             'starts_at', x.starts_at,
             'ends_at', x.ends_at, 'status', x.status) order by x.original_date)
           from public.recurrence_exceptions x where x.event_id = v.id), '[]'::jsonb),
         case when v.access = 'full' then coalesce((
           select array_agg(a.user_id order by a.user_id) from public.event_attendees a where a.event_id = v.id),
           '{}'::uuid[]) else '{}'::uuid[] end,
         coalesce((
           select array_agg(r.minutes_before order by r.minutes_before)
           from public.reminders r where r.event_id = v.id and r.user_id = auth.uid()), '{}'::integer[]),
         case when v.access = 'full' then v.task_id end,
         case when v.access = 'full' then v.external_uid end,
         case when v.access = 'full' then v.decoration end
  from visible v
  where v.access is not null
  order by v.starts_at
  limit 5000;
$$;

create or replace function public.duplicate_calendar(p_calendar_id uuid, p_name text default null, p_include_events boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_role text := private.calendar_role(p_calendar_id);
  v_new uuid;
  v_new_event uuid;
  e record;
begin
  if v_role is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.calendars (owner_id, name, description, color, icon, kind, default_timezone,
    default_member_role, admins_can_invite, members_can_invite, editors_can_edit_all,
    allow_private_events, conflict_policy, notify_members_on_changes)
  select v_uid, left(coalesce(nullif(btrim(p_name), ''), c.name || ' (cópia)'), 80), c.description, c.color,
         c.icon, case when c.kind = 'personal' then 'custom' else c.kind end, c.default_timezone,
         c.default_member_role, c.admins_can_invite, c.members_can_invite, c.editors_can_edit_all,
         c.allow_private_events, c.conflict_policy, c.notify_members_on_changes
  from public.calendars c where c.id = p_calendar_id
  returning id into v_new;

  if p_include_events then
    for e in
      select * from public.events ev
      where ev.calendar_id = p_calendar_id and ev.deleted_at is null
        and private.event_access_for(v_role, v_uid, ev.id, ev.created_by, ev.privacy) = 'full'
    loop
      insert into public.events (calendar_id, title, description, location, address, url, all_day,
        starts_at, ends_at, start_date, end_date, timezone, recurrence_rule, color, event_type,
        status, privacy, change_origin, decoration)
      values (v_new, e.title, e.description, e.location, e.address, e.url, e.all_day,
        e.starts_at, e.ends_at, e.start_date, e.end_date, e.timezone, e.recurrence_rule, e.color,
        e.event_type, e.status, case when e.privacy = 'participants' then 'members' else e.privacy end, 'system', e.decoration)
      returning id into v_new_event;

      insert into public.recurrence_exceptions (event_id, original_date, is_cancelled, title, description, location, starts_at, ends_at, status)
      select v_new_event, x.original_date, x.is_cancelled, x.title, x.description, x.location, x.starts_at, x.ends_at, x.status
      from public.recurrence_exceptions x where x.event_id = e.id;
    end loop;
  end if;

  return v_new;
end;
$$;
