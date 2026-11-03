-- Rotina privada nas preferências; decorações acompanham as permissões dos próprios itens.
alter table public.user_preferences add column routine_periods jsonb not null default '[]'::jsonb;
grant update (routine_periods) on public.user_preferences to authenticated;

create function private.validate_routine_periods()
returns trigger language plpgsql set search_path = '' as $$
declare p jsonb;
begin
  if jsonb_typeof(new.routine_periods) <> 'array' or jsonb_array_length(new.routine_periods) > 30 then
    raise exception 'INVALID_ROUTINE' using errcode = 'P0001';
  end if;
  for p in select value from jsonb_array_elements(new.routine_periods) loop
    if not coalesce(jsonb_typeof(p) = 'object'
      and jsonb_typeof(p->'id') = 'string' and char_length(p->>'id') between 1 and 100
      and jsonb_typeof(p->'title') = 'string' and char_length(btrim(p->>'title')) between 1 and 60
      and p->>'kind' in ('work','school','sleep','commute','meal','exercise','care','custom')
      and jsonb_typeof(p->'enabled') = 'boolean'
      and jsonb_typeof(p->'days') = 'array'
      and p->>'start' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and p->>'end' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and p->>'start' <> p->>'end'
      and exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p->>'timezone'), false) then
      raise exception 'INVALID_ROUTINE' using errcode = 'P0001';
    end if;
    if jsonb_array_length(p->'days') not between 1 and 7
      or exists(select 1 from jsonb_array_elements(p->'days') d where jsonb_typeof(d) <> 'number' or d::text !~ '^[0-6]$')
      or (select count(distinct d) from jsonb_array_elements(p->'days') d) <> jsonb_array_length(p->'days') then
      raise exception 'INVALID_ROUTINE' using errcode = 'P0001';
    end if;
  end loop;
  if (select count(distinct item->>'id') from jsonb_array_elements(new.routine_periods) item) <> jsonb_array_length(new.routine_periods) then
    raise exception 'INVALID_ROUTINE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger user_routine_validate before insert or update of routine_periods on public.user_preferences
  for each row execute function private.validate_routine_periods();
revoke all on function private.validate_routine_periods() from public, anon;

alter table public.events add column decoration text check (decoration is null or decoration in ('decor-sol','decor-lua','decor-flor','decor-folha','decor-onda','decor-montanha','decor-orbita','decor-coracao','decor-livro','decor-cafe','decor-laco','decor-cometa'));
alter table public.tasks add column decoration text check (decoration is null or decoration in ('decor-sol','decor-lua','decor-flor','decor-folha','decor-onda','decor-montanha','decor-orbita','decor-coracao','decor-livro','decor-cafe','decor-laco','decor-cometa'));
alter table public.notes add column decoration text check (decoration is null or decoration in ('decor-sol','decor-lua','decor-flor','decor-folha','decor-onda','decor-montanha','decor-orbita','decor-coracao','decor-livro','decor-cafe','decor-laco','decor-cometa'));
alter table public.habits add column decoration text check (decoration is null or decoration in ('decor-sol','decor-lua','decor-flor','decor-folha','decor-onda','decor-montanha','decor-orbita','decor-coracao','decor-livro','decor-cafe','decor-laco','decor-cometa'));
grant insert (decoration), update (decoration) on public.events to authenticated;

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
        location, starts_at, ends_at)
      values (p_event_id, (v_p ->> 'original_date')::date, coalesce((v_p ->> 'is_cancelled')::boolean, false),
        v_p ->> 'title', v_p ->> 'description', v_p ->> 'location',
        (v_p ->> 'starts_at')::timestamptz, (v_p ->> 'ends_at')::timestamptz)
      on conflict (event_id, original_date) do update set
        is_cancelled = excluded.is_cancelled,
        title = excluded.title,
        description = excluded.description,
        location = excluded.location,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at
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

drop function public.list_events(uuid[], timestamptz, timestamptz);
create function public.list_events(p_calendar_ids uuid[], p_from timestamptz, p_to timestamptz)
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
             'ends_at', x.ends_at) order by x.original_date)
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
revoke all on function public.list_events(uuid[], timestamptz, timestamptz) from public, anon;
grant execute on function public.list_events(uuid[], timestamptz, timestamptz) to authenticated;

create or replace function private.task_op(
  p_kind text, p_id uuid, p jsonb, p_base_version integer, p_origin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cur public.tasks;
  v_row public.tasks;
  v_cal uuid;
  v_can_edit boolean;
  v_can_complete boolean;
  v_date date;
  v_next date;
  v_cid uuid;
  v_key text;
  v_changed text[] := '{}';
  v_public boolean;
  v_details jsonb;
  v_item jsonb;
begin
  if p_kind = 'create' then
    v_cal := (p ->> 'calendar_id')::uuid;
    if not private.can_create_in(v_cal) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    insert into public.tasks (id, item_type, calendar_id, list_id, title, description, links, tags,
      start_date, due_date, due_time, timezone, estimated_minutes, priority, status, recurrence_rule,
      recurrence_mode, assignee_id, privacy, position, change_origin, decoration)
    values (p_id, coalesce(p ->> 'item_type', 'task'), v_cal, (p ->> 'list_id')::uuid, p ->> 'title',
      p ->> 'description', coalesce(private.jsonb_text_array(p -> 'links'), '{}'),
      coalesce(private.jsonb_text_array(p -> 'tags'), '{}'), (p ->> 'start_date')::date,
      (p ->> 'due_date')::date, (p ->> 'due_time')::time, coalesce(p ->> 'timezone', 'America/Sao_Paulo'),
      (p ->> 'estimated_minutes')::integer, coalesce((p ->> 'priority')::smallint, 0),
      coalesce(p ->> 'status', 'pending'), p ->> 'recurrence_rule', coalesce(p ->> 'recurrence_mode', 'calendar'),
      (p ->> 'assignee_id')::uuid, coalesce(p ->> 'privacy', 'members'),
      coalesce((p ->> 'position')::double precision, extract(epoch from now())), p_origin, p ->> 'decoration')
    on conflict (id) do nothing
    returning * into v_row;
    if v_row.id is null then
      select * into v_cur from public.tasks where id = p_id;
      if v_cur.created_by = v_uid then
        return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
      end if;
      raise exception 'DUPLICATE_ID' using errcode = 'P0001';
    end if;
    if p ? 'participant_ids' then
      perform private.task_set_participants(v_row, array(select jsonb_array_elements_text(p -> 'participant_ids'))::uuid[]);
    end if;
    if p ? 'alerts' then
      perform private.task_set_alerts(p_id, array(select jsonb_array_elements_text(p -> 'alerts'))::integer[]);
    end if;
    if p ? 'plan_day' then
      perform private.task_set_plan(p_id, (p ->> 'plan_day')::date);
    end if;
    if jsonb_typeof(p -> 'checklist') = 'array' then
      for v_item in select * from jsonb_array_elements(p -> 'checklist') loop
        perform private.task_checklist_upsert(v_row, v_item, true);
      end loop;
    end if;
    if v_row.status = 'done' then
      insert into public.task_completions (task_id, occurrence_date, completed_by) values (p_id, null, v_uid);
    end if;
    v_public := v_row.calendar_id is null or v_row.privacy = 'members';
    perform private.log_item(v_row.calendar_id, v_uid, 'task', p_id, 'created',
      jsonb_build_object('title', case when v_public then v_row.title end, 'item_type', v_row.item_type));
    if v_row.assignee_id is not null then
      perform private.notify_task(v_row.assignee_id, v_row, 'task_assigned', 'Nova tarefa para você',
        private.display_name(v_uid) || ': ' || v_row.title);
    end if;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  select * into v_cur from public.tasks where id = p_id for update;
  if v_cur.id is null or not private.task_access(v_cur.calendar_id, v_cur.id, v_cur.created_by, v_cur.assignee_id, v_cur.privacy)
     or (v_cur.calendar_id is not null and exists (select 1 from public.calendars c where c.id = v_cur.calendar_id and c.deleted_at is not null)) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_can_edit := private.can_edit_item(v_cur.calendar_id, v_cur.created_by);
  v_can_complete := v_can_edit or (v_cur.assignee_id = v_uid
    and (v_cur.calendar_id is null or private.calendar_is_writable(v_cur.calendar_id)));
  v_public := v_cur.calendar_id is null or v_cur.privacy = 'members';

  if p_kind = 'restore' then
    if not v_can_edit then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    if v_cur.deleted_at is not null then
      update public.tasks set deleted_at = null, change_origin = p_origin where id = p_id;
      perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'task', p_id, 'restored',
        jsonb_build_object('title', case when v_public then v_cur.title end));
    end if;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if v_cur.deleted_at is not null then
    if p_kind = 'delete' then
      return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
    end if;
    if p_kind in ('update', 'complete', 'reopen') then
      return jsonb_build_object('status', 'conflict', 'reason', 'deleted', 'task', private.task_json(p_id));
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_kind = 'update' then
    if p_base_version is not null and v_cur.version <> p_base_version then
      return jsonb_build_object('status', 'conflict', 'reason', 'version', 'task', private.task_json(p_id));
    end if;
    if not v_can_edit then
      -- Responsável sem permissão de edição: só muda o andamento.
      if not (v_can_complete and not exists (
                select 1 from jsonb_object_keys(p) k where k not in ('status', 'position'))) then
        raise exception 'FORBIDDEN' using errcode = 'P0001';
      end if;
    end if;
    v_cal := case when p ? 'calendar_id' then (p ->> 'calendar_id')::uuid else v_cur.calendar_id end;
    if v_cal is distinct from v_cur.calendar_id then
      if v_cal is null and v_cur.created_by is distinct from v_uid then
        raise exception 'FORBIDDEN' using errcode = 'P0001';
      end if;
      if not private.can_create_in(v_cal) then
        raise exception 'FORBIDDEN' using errcode = 'P0001';
      end if;
    end if;
    update public.tasks t set
          decoration = case when p ? 'decoration' then p ->> 'decoration' else t.decoration end,
      item_type = case when p ? 'item_type' then p ->> 'item_type' else t.item_type end,
      calendar_id = v_cal,
      list_id = case when p ? 'list_id' then (p ->> 'list_id')::uuid
                     when v_cal is distinct from v_cur.calendar_id then null else t.list_id end,
      title = case when p ? 'title' then p ->> 'title' else t.title end,
      description = case when p ? 'description' then p ->> 'description' else t.description end,
      links = case when p ? 'links' then coalesce(private.jsonb_text_array(p -> 'links'), '{}') else t.links end,
      tags = case when p ? 'tags' then coalesce(private.jsonb_text_array(p -> 'tags'), '{}') else t.tags end,
      start_date = case when p ? 'start_date' then (p ->> 'start_date')::date else t.start_date end,
      due_date = case when p ? 'due_date' then (p ->> 'due_date')::date else t.due_date end,
      due_time = case when p ? 'due_time' then (p ->> 'due_time')::time else t.due_time end,
      timezone = case when p ? 'timezone' then p ->> 'timezone' else t.timezone end,
      estimated_minutes = case when p ? 'estimated_minutes' then (p ->> 'estimated_minutes')::integer else t.estimated_minutes end,
      priority = case when p ? 'priority' then (p ->> 'priority')::smallint else t.priority end,
      status = case when p ? 'status' then p ->> 'status' else t.status end,
      recurrence_rule = case when p ? 'recurrence_rule' then p ->> 'recurrence_rule' else t.recurrence_rule end,
      recurrence_mode = case when p ? 'recurrence_mode' then p ->> 'recurrence_mode' else t.recurrence_mode end,
      assignee_id = case
        when p ? 'assignee_id' then (p ->> 'assignee_id')::uuid
        when v_cal is distinct from v_cur.calendar_id and (v_cal is null or not exists (
          select 1 from public.calendar_members m where m.calendar_id = v_cal
            and m.user_id = t.assignee_id and m.status = 'active')) then null
        else t.assignee_id end,
      privacy = case when p ? 'privacy' then p ->> 'privacy' else t.privacy end,
      position = case when p ? 'position' then (p ->> 'position')::double precision else t.position end,
      change_origin = p_origin
    where t.id = p_id
    returning * into v_row;

    if v_cal is distinct from v_cur.calendar_id then
      delete from public.task_participants x where x.task_id = p_id and (v_cal is null or not exists (
        select 1 from public.calendar_members m where m.calendar_id = v_cal and m.user_id = x.user_id and m.status = 'active'));
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'moved', '{}'::jsonb);
    end if;

    foreach v_key in array array['title', 'description', 'due_date', 'due_time', 'priority', 'status',
                                 'assignee_id', 'recurrence_rule', 'list_id', 'tags', 'privacy', 'decoration'] loop
      if (to_jsonb(v_row) -> v_key) is distinct from (to_jsonb(v_cur) -> v_key) then
        v_changed := array_append(v_changed, v_key);
      end if;
    end loop;
    v_public := v_row.calendar_id is null or v_row.privacy = 'members';
    v_details := jsonb_build_object('title', case when v_public then v_row.title end, 'changed', to_jsonb(v_changed));

    if v_row.status = 'done' and v_cur.status <> 'done' then
      insert into public.task_completions (task_id, occurrence_date, completed_by) values (p_id, null, v_uid)
      on conflict do nothing;
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'completed', v_details);
      if v_row.created_by is distinct from v_uid then
        perform private.notify_task(v_row.created_by, v_row, 'task_completed', 'Tarefa concluída',
          private.display_name(v_uid) || ' concluiu "' || v_row.title || '"');
      end if;
    elsif v_cur.status = 'done' and v_row.status <> 'done' then
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'reopened', v_details);
    elsif 'assignee_id' = any (v_changed) then
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'assigned', v_details);
    elsif 'due_date' = any (v_changed) or 'due_time' = any (v_changed) then
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'rescheduled',
        v_details || jsonb_build_object('due_date', v_row.due_date));
    elsif cardinality(v_changed) > 0 then
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'updated', v_details);
    end if;
    if v_row.assignee_id is not null and v_row.assignee_id is distinct from v_cur.assignee_id then
      perform private.notify_task(v_row.assignee_id, v_row, 'task_assigned', 'Nova tarefa para você',
        private.display_name(v_uid) || ': ' || v_row.title);
    end if;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'delete' then
    if not v_can_edit then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    if p_base_version is not null and v_cur.version <> p_base_version then
      return jsonb_build_object('status', 'conflict', 'reason', 'version', 'task', private.task_json(p_id));
    end if;
    update public.tasks set deleted_at = now(), change_origin = p_origin where id = p_id;
    perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'task', p_id, 'deleted',
      jsonb_build_object('title', case when v_public then v_cur.title end));
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'complete' then
    if not v_can_complete then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    if v_cur.recurrence_rule is null or v_cur.status in ('done', 'cancelled') then
      if v_cur.status <> 'done' then
        update public.tasks set status = 'done', change_origin = p_origin where id = p_id returning * into v_row;
        insert into public.task_completions (task_id, occurrence_date, completed_by) values (p_id, null, v_uid);
        perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'task', p_id, 'completed',
          jsonb_build_object('title', case when v_public then v_cur.title end));
        if v_cur.created_by is distinct from v_uid then
          perform private.notify_task(v_cur.created_by, v_row, 'task_completed', 'Tarefa concluída',
            private.display_name(v_uid) || ' concluiu "' || v_cur.title || '"');
        end if;
      end if;
      return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
    end if;
    -- Recorrente: registra a ocorrência e avança o prazo uma única vez.
    v_date := coalesce((p ->> 'occurrence_date')::date, v_cur.due_date);
    insert into public.task_completions (task_id, occurrence_date, completed_by)
    values (p_id, v_date, v_uid)
    on conflict (task_id, occurrence_date) do nothing
    returning id into v_cid;
    if v_cid is not null and v_date >= v_cur.due_date then
      v_next := case when v_cur.recurrence_mode = 'completion'
                     then private.rrule_add(v_cur.recurrence_rule, (now() at time zone v_cur.timezone)::date)
                     else private.rrule_next(v_cur.recurrence_rule, coalesce(v_cur.recurrence_start, v_cur.due_date), v_date) end;
      update public.tasks set
        due_date = coalesce(v_next, due_date),
        start_date = case when v_next is not null and start_date is not null
                          then least(start_date + (v_next - v_cur.due_date), v_next) else start_date end,
        status = case when v_next is null then 'done' else 'pending' end,
        change_origin = p_origin
      where id = p_id;
      -- Nova ocorrência começa com as etapas desmarcadas.
      if v_next is not null then
        update public.task_checklist_items set done = false, done_at = null, done_by = null, updated_at = now()
        where task_id = p_id and done;
      end if;
    end if;
    if v_cid is not null then
      perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'task', p_id, 'completed',
        jsonb_build_object('title', case when v_public then v_cur.title end, 'occurrence_date', v_date));
    end if;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'reopen' then
    if not v_can_complete then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    v_date := (p ->> 'occurrence_date')::date;
    if v_cur.recurrence_rule is not null and v_date is not null then
      delete from public.task_completions where task_id = p_id and occurrence_date = v_date returning id into v_cid;
      if v_cid is not null then
        update public.tasks set
          due_date = case when v_cur.status = 'done' or v_date < due_date then v_date else due_date end,
          status = 'pending', change_origin = p_origin
        where id = p_id;
      end if;
    elsif v_cur.status in ('done', 'cancelled') then
      update public.tasks set status = 'pending', change_origin = p_origin where id = p_id;
      v_cid := p_id;
    end if;
    if v_cid is not null then
      perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'task', p_id, 'reopened',
        jsonb_build_object('title', case when v_public then v_cur.title end, 'occurrence_date', v_date));
    end if;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'checklist_upsert' then
    if not v_can_complete then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    perform private.task_checklist_upsert(v_cur, p, v_can_edit);
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'checklist_delete' then
    if not v_can_edit then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    delete from public.task_checklist_items where id = (p ->> 'id')::uuid and task_id = p_id;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'participants_set' then
    if not v_can_edit then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    perform private.task_set_participants(v_cur, array(select jsonb_array_elements_text(p -> 'user_ids'))::uuid[]);
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'alerts_set' then
    perform private.task_set_alerts(p_id, array(select jsonb_array_elements_text(p -> 'minutes'))::integer[]);
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'plan_set' then
    perform private.task_set_plan(p_id, (p ->> 'day')::date);
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  raise exception 'INVALID_OPERATION' using errcode = 'P0001';
end;
$$;

create or replace function private.note_op(
  p_kind text, p_id uuid, p jsonb, p_base_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cur public.notes;
  v_row public.notes;
  v_cal uuid;
  v_event uuid;
  v_task uuid;
begin
  if p_kind = 'create' then
    v_cal := (p ->> 'calendar_id')::uuid;
    if not private.can_create_in(v_cal) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    v_event := (p ->> 'event_id')::uuid;
    v_task := (p ->> 'task_id')::uuid;
    if v_event is not null and not exists (select 1 from public.events e where e.id = v_event
         and e.calendar_id is not distinct from v_cal and private.event_access_by_id(v_event) = 'full') then
      raise exception 'INVALID_REFERENCE' using errcode = 'P0001';
    end if;
    if v_task is not null and not private.task_visible(v_task) then
      raise exception 'INVALID_REFERENCE' using errcode = 'P0001';
    end if;
    insert into public.notes (id, calendar_id, title, body, pinned, event_id, task_id, decoration)
    values (p_id, v_cal, nullif(btrim(p ->> 'title'), ''), coalesce(p ->> 'body', ''),
            coalesce((p ->> 'pinned')::boolean, false), v_event, v_task, p ->> 'decoration')
    on conflict (id) do nothing
    returning * into v_row;
    if v_row.id is null then
      select * into v_cur from public.notes where id = p_id;
      if v_cur.created_by is distinct from auth.uid() then
        raise exception 'DUPLICATE_ID' using errcode = 'P0001';
      end if;
      v_row := v_cur;
    else
      perform private.log_item(v_row.calendar_id, auth.uid(), 'note', p_id, 'created',
        jsonb_build_object('title', v_row.title));
    end if;
    return jsonb_build_object('status', 'ok', 'note', to_jsonb(v_row));
  end if;

  select * into v_cur from public.notes where id = p_id for update;
  if v_cur.id is null or not private.list_visible(v_cur.calendar_id, v_cur.created_by) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.can_edit_item(v_cur.calendar_id, v_cur.created_by) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_kind = 'restore' then
    update public.notes set deleted_at = null where id = p_id returning * into v_row;
    return jsonb_build_object('status', 'ok', 'note', to_jsonb(v_row));
  end if;
  if v_cur.deleted_at is not null then
    if p_kind = 'delete' then
      return jsonb_build_object('status', 'ok', 'note', to_jsonb(v_cur));
    end if;
    return jsonb_build_object('status', 'conflict', 'reason', 'deleted', 'note', to_jsonb(v_cur));
  end if;
  if p_kind = 'update' then
    if p_base_version is not null and v_cur.version <> p_base_version and (p ? 'title' or p ? 'body' or p ? 'decoration') then
      return jsonb_build_object('status', 'conflict', 'reason', 'version', 'note', to_jsonb(v_cur));
    end if;
    update public.notes n set
          decoration = case when p ? 'decoration' then p ->> 'decoration' else n.decoration end,
      title = case when p ? 'title' then nullif(btrim(p ->> 'title'), '') else n.title end,
      body = case when p ? 'body' then coalesce(p ->> 'body', '') else n.body end,
      pinned = case when p ? 'pinned' then (p ->> 'pinned')::boolean else n.pinned end
    where n.id = p_id
    returning * into v_row;
    perform private.log_item(v_row.calendar_id, v_row.created_by, 'note', p_id, 'updated',
      jsonb_build_object('title', v_row.title));
    return jsonb_build_object('status', 'ok', 'note', to_jsonb(v_row));
  end if;
  if p_kind = 'delete' then
    update public.notes set deleted_at = now() where id = p_id returning * into v_row;
    perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'note', p_id, 'deleted',
      jsonb_build_object('title', v_cur.title));
    return jsonb_build_object('status', 'ok', 'note', to_jsonb(v_row));
  end if;
  raise exception 'INVALID_OPERATION' using errcode = 'P0001';
end;
$$;

create or replace function private.habit_op(
  p_kind text, p_id uuid, p jsonb, p_base_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cur public.habits;
  v_row public.habits;
  v_cal uuid;
  v_day date;
begin
  if p_kind = 'create' then
    v_cal := (p ->> 'calendar_id')::uuid;
    if not private.can_create_in(v_cal) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    insert into public.habits (id, calendar_id, title, description, color, recurrence_rule, start_date, show_streak, decoration)
    values (p_id, v_cal, btrim(p ->> 'title'), nullif(btrim(p ->> 'description'), ''), p ->> 'color',
            coalesce(p ->> 'recurrence_rule', 'FREQ=DAILY'), coalesce((p ->> 'start_date')::date, current_date),
            coalesce((p ->> 'show_streak')::boolean, false), p ->> 'decoration')
    on conflict (id) do nothing
    returning * into v_row;
    if v_row.id is null then
      select * into v_cur from public.habits where id = p_id;
      if v_cur.created_by is distinct from auth.uid() then
        raise exception 'DUPLICATE_ID' using errcode = 'P0001';
      end if;
    else
      perform private.log_item(v_row.calendar_id, auth.uid(), 'habit', p_id, 'created',
        jsonb_build_object('title', v_row.title));
    end if;
    return jsonb_build_object('status', 'ok', 'habit', private.habit_json(p_id, current_date - 70));
  end if;

  select * into v_cur from public.habits where id = p_id for update;
  if v_cur.id is null or v_cur.deleted_at is not null or not private.list_visible(v_cur.calendar_id, v_cur.created_by) then
    if p_kind = 'delete' then
      return jsonb_build_object('status', 'ok', 'habit', to_jsonb(v_cur));
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_kind = 'log_set' then
    -- Cada pessoa registra só a própria participação.
    if v_cur.calendar_id is not null and not private.calendar_is_writable(v_cur.calendar_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    v_day := (p ->> 'day')::date;
    if v_day is null or v_day > current_date + 1 or v_day < current_date - 366 then
      raise exception 'INVALID_DATA' using errcode = 'P0001';
    end if;
    if coalesce((p ->> 'done')::boolean, true) then
      insert into public.habit_logs (habit_id, user_id, day) values (p_id, auth.uid(), v_day)
      on conflict do nothing;
    else
      delete from public.habit_logs where habit_id = p_id and user_id = auth.uid() and day = v_day;
    end if;
    return jsonb_build_object('status', 'ok', 'habit', private.habit_json(p_id, current_date - 70));
  end if;

  if not private.can_edit_item(v_cur.calendar_id, v_cur.created_by) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_kind = 'update' then
    update public.habits h set
          decoration = case when p ? 'decoration' then p ->> 'decoration' else h.decoration end,
      title = case when p ? 'title' then btrim(p ->> 'title') else h.title end,
      description = case when p ? 'description' then nullif(btrim(p ->> 'description'), '') else h.description end,
      color = case when p ? 'color' then p ->> 'color' else h.color end,
      recurrence_rule = case when p ? 'recurrence_rule' then p ->> 'recurrence_rule' else h.recurrence_rule end,
      status = case when p ? 'status' then p ->> 'status' else h.status end,
      show_streak = case when p ? 'show_streak' then (p ->> 'show_streak')::boolean else h.show_streak end
    where h.id = p_id
    returning * into v_row;
    return jsonb_build_object('status', 'ok', 'habit', private.habit_json(p_id, current_date - 70));
  end if;
  if p_kind = 'delete' then
    update public.habits set deleted_at = now() where id = p_id returning * into v_row;
    perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'habit', p_id, 'deleted',
      jsonb_build_object('title', v_cur.title));
    return jsonb_build_object('status', 'ok', 'habit', to_jsonb(v_row));
  end if;
  raise exception 'INVALID_OPERATION' using errcode = 'P0001';
end;
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

      insert into public.recurrence_exceptions (event_id, original_date, is_cancelled, title, description, location, starts_at, ends_at)
      select v_new_event, x.original_date, x.is_cancelled, x.title, x.description, x.location, x.starts_at, x.ends_at
      from public.recurrence_exceptions x where x.event_id = e.id;
    end loop;
  end if;

  return v_new;
end;
$$;
