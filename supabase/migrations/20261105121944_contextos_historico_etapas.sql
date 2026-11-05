-- A classificação pertence à pessoa, inclusive quando o compromisso é compartilhado.
create table private.item_contexts(
 user_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('work','school','sleep','commute','meal','exercise','care','custom')),
 event_id uuid references public.events(id) on delete cascade,
 task_id uuid references public.tasks(id) on delete cascade,
 note_id uuid references public.notes(id) on delete cascade,
 habit_id uuid references public.habits(id) on delete cascade,
 check(num_nonnulls(event_id,task_id,note_id,habit_id)=1),
 unique(user_id,event_id),unique(user_id,task_id),unique(user_id,note_id),unique(user_id,habit_id)
);
revoke all on private.item_contexts from public,anon,authenticated;
create function private.context_visible(entity text,item uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select case entity when 'event' then exists(select 1 from public.events where id=item and deleted_at is null and private.event_access_by_id(id)='full')
 when 'task' then exists(select 1 from public.tasks where id=item and deleted_at is null and private.task_visible(id))
 when 'note' then exists(select 1 from public.notes where id=item and deleted_at is null and private.list_visible(calendar_id,created_by))
 when 'habit' then exists(select 1 from public.habits where id=item and deleted_at is null and private.list_visible(calendar_id,created_by))
 else false end;
$$;
revoke all on function private.context_visible(text,uuid) from public,anon,authenticated;
create function public.set_my_item_context(p_entity text,p_item uuid,p_kind text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();
begin
 if not private.context_visible(p_entity,p_item) then raise exception 'NOT_FOUND'; end if;
 if p_kind is not null and p_kind not in ('work','school','sleep','commute','meal','exercise','care','custom') then raise exception 'INVALID_DATA'; end if;
 -- context_visible restringe a lista de entidades e format escapa o identificador.
 if p_kind is null then execute format('delete from private.item_contexts where user_id=$1 and %I=$2',p_entity||'_id') using u,p_item;
 else execute format('insert into private.item_contexts(user_id,kind,%1$I) values($1,$2,$3) on conflict(user_id,%1$I) do update set kind=excluded.kind',p_entity||'_id') using u,p_kind,p_item;
 end if;
end; $$;
revoke all on function public.set_my_item_context(text,uuid,text) from public,anon;
grant execute on function public.set_my_item_context(text,uuid,text) to authenticated;
create or replace function public.get_my_account()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'email', u.email,
    'email_confirmed', u.email_confirmed_at is not null,
    'display_name', p.display_name,
    'avatar_color', p.avatar_color,
    'avatar_url', p.avatar_url,
    'account_status', p.account_status,
    'created_at', p.created_at,
    'last_seen_at', p.last_seen_at,
    'contexts', coalesce((select jsonb_object_agg(entity||':'||item::text,c.kind) from private.item_contexts c
     cross join lateral (values ('event',c.event_id),('task',c.task_id),('note',c.note_id),('habit',c.habit_id)) v(entity,item)
     where c.user_id=auth.uid() and item is not null and private.context_visible(entity,item)), '{}'::jsonb),
    'preferences', to_jsonb(up) - 'user_id',
    'notification_preferences', to_jsonb(np) - 'user_id')
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_preferences up on up.user_id = p.id
  left join public.notification_preferences np on np.user_id = p.id
  where p.id = auth.uid();
$$;
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

  if p_kind='create' and v_result->>'status'='ok' and p_payload ? 'personal_context' then
    perform public.set_my_item_context('event',p_event_id,p_payload->>'personal_context');
  end if;
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
create or replace function public.apply_item_op(
  p_op_id uuid, p_entity text, p_kind text, p_id uuid, p_payload jsonb default '{}'::jsonb,
  p_base_version integer default null, p_origin text default 'app')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_prev jsonb;
  v_result jsonb;
  v_origin text := case when p_origin = 'offline_sync' then 'offline_sync' else 'app' end;
  v_p jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if p_op_id is null or p_id is null then
    raise exception 'INVALID_OPERATION' using errcode = 'P0001';
  end if;
  select s.result into v_prev from public.sync_operations s where s.id = p_op_id and s.user_id = v_uid;
  if v_prev is not null then
    -- Reenvio: devolve o estado atual do item (o resultado antigo não guarda dados).
    v_result := case p_entity
      when 'task' then case when private.task_visible(p_id) then jsonb_build_object('task', private.task_json(p_id)) else '{}'::jsonb end
      else '{}'::jsonb end;
    return v_prev || v_result || jsonb_build_object('replayed', true);
  end if;

  begin
    if p_entity = 'task' then
      v_result := private.task_op(p_kind, p_id, v_p, p_base_version, v_origin);
    elsif p_entity = 'list' then
      v_result := private.list_op(p_kind, p_id, v_p, p_base_version);
    elsif p_entity = 'note' then
      v_result := private.note_op(p_kind, p_id, v_p, p_base_version);
    elsif p_entity = 'habit' then
      v_result := private.habit_op(p_kind, p_id, v_p, p_base_version);
    elsif p_entity = 'checkin' and p_kind = 'mark' then
      insert into public.daily_checkins (user_id, day) values (v_uid, (v_p ->> 'day')::date)
      on conflict do nothing;
      v_result := jsonb_build_object('status', 'ok');
    else
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_OPERATION');
    end if;
  exception
    when insufficient_privilege then
      v_result := jsonb_build_object('status', 'error', 'code', 'FORBIDDEN');
    when check_violation or not_null_violation or invalid_text_representation
         or invalid_datetime_format or datetime_field_overflow or string_data_right_truncation
         or numeric_value_out_of_range or invalid_parameter_value then
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_DATA');
    when foreign_key_violation then
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_REFERENCE');
    when unique_violation then
      v_result := jsonb_build_object('status', 'error', 'code', 'DUPLICATE_ID');
    when raise_exception then
      v_result := jsonb_build_object('status', 'error', 'code', sqlerrm);
  end;

  if p_kind='create' and v_result->>'status'='ok' and p_payload ? 'personal_context' then
    perform public.set_my_item_context(p_entity,p_id,p_payload->>'personal_context');
  end if;
  if v_result ->> 'status' in ('ok', 'error') then
    insert into public.sync_operations (id, user_id, kind, entity_id, result)
    values (p_op_id, v_uid, p_entity || ':' || p_kind, p_id, jsonb_strip_nulls(jsonb_build_object(
      'status', v_result ->> 'status', 'code', v_result ->> 'code', 'entity_id', p_id)))
    on conflict (id) do nothing;
  end if;
  return v_result;
end;
$$;
alter table public.task_completions add column checklist_snapshot jsonb;
create function private.snapshot_steps() returns trigger language plpgsql set search_path='' as $$
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'done',i.done,'done_at',i.done_at,'done_by',i.done_by) order by i.position,i.id),'[]'::jsonb)
 into new.checklist_snapshot from public.task_checklist_items i where i.task_id=new.task_id;
 return new;
end; $$;
create trigger task_completion_snapshot before insert on public.task_completions for each row execute function private.snapshot_steps();

create or replace function public.list_task_history(p_task_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.task_visible(p_task_id) then '[]'::jsonb else coalesce((
    select jsonb_agg(x order by x ->> 'at' desc) from (
      select jsonb_build_object('kind', 'activity', 'action', a.action, 'details', a.details,
               'at', a.created_at, 'actor_name', private.display_name(a.actor_id)) as x
      from public.item_activity a where a.entity_id = p_task_id
      union all
      select jsonb_build_object('kind', 'completion', 'occurrence_date', c.occurrence_date, 'steps', c.checklist_snapshot,
               'at', c.completed_at, 'actor_name', private.display_name(c.completed_by))
      from public.task_completions c where c.task_id = p_task_id
      order by 1
      limit 300) s), '[]'::jsonb) end;
$$;
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
  v_steps jsonb;
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
      delete from public.task_completions where task_id = p_id and occurrence_date = v_date returning id,checklist_snapshot into v_cid,v_steps;
      if v_cid is not null then
        update public.task_checklist_items i set done=s.done,done_at=s.done_at,
          done_by=(select id from public.profiles where id=s.done_by)
        from jsonb_to_recordset(v_steps) as s(id uuid,done boolean,done_at timestamptz,done_by uuid)
        where i.task_id=p_id and i.id=s.id;
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
create function public.promote_checklist_step(p_task uuid,p_step uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.tasks; step public.task_checklist_items; result jsonb; child uuid:=gen_random_uuid();
begin
 select * into t from public.tasks where id=p_task and deleted_at is null for update;
 if not found or not private.task_visible(p_task) or not private.can_edit_item(t.calendar_id,t.created_by) then raise exception 'NOT_FOUND'; end if;
 select * into step from public.task_checklist_items where id=p_step and task_id=p_task for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if step.done then raise exception 'STEP_ALREADY_COMPLETE'; end if;
 result:=public.apply_item_op(gen_random_uuid(),'task','create',child,jsonb_build_object('title',step.title,'calendar_id',t.calendar_id,'list_id',t.list_id,'privacy',case when t.privacy='members' then 'members' else 'private' end,'timezone',t.timezone));
 if result->>'status'<>'ok' then raise exception 'INVALID_DATA'; end if;
 delete from public.task_checklist_items where id=p_step and task_id=p_task;
 return child;
end; $$;
revoke all on function public.promote_checklist_step(uuid,uuid) from public,anon;
grant execute on function public.promote_checklist_step(uuid,uuid) to authenticated;


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
         and (v_cal is null or (e.calendar_id=v_cal and e.privacy='members')) and private.event_access_by_id(v_event) = 'full') then
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
create function private.detach_restricted_note_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.notes set event_id=null where event_id=new.id and (calendar_id is not null or created_by is distinct from new.created_by);
 return new;
end; $$;
revoke all on function private.detach_restricted_note_event() from public,anon,authenticated;
create trigger event_note_visibility after update of privacy on public.events for each row
 when (old.privacy is distinct from new.privacy and new.privacy<>'members') execute function private.detach_restricted_note_event();
update public.notes n set event_id=null from public.events e where e.id=n.event_id and n.calendar_id is not null and e.privacy<>'members';

create table private.note_versions(
 id bigint generated always as identity primary key,
 note_id uuid not null references public.notes(id) on delete cascade,
 title text,body text not null,saved_at timestamptz not null default now()
);
create index note_versions_recent on private.note_versions(note_id,id desc);
revoke all on private.note_versions from public,anon,authenticated;
create function private.remember_note_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.note_versions(note_id,title,body) values(old.id,old.title,old.body);
 delete from private.note_versions where note_id=old.id and id <=
   (select id from private.note_versions where note_id=old.id order by id desc offset 20 limit 1);
 return new;
end; $$;
revoke all on function private.remember_note_version() from public,anon,authenticated;
create trigger note_version after update of title,body on public.notes for each row
 when(old.title is distinct from new.title or old.body is distinct from new.body) execute function private.remember_note_version();
create function public.note_versions(p_note uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'body',v.body,'saved_at',v.saved_at) order by v.id desc),'[]'::jsonb)
 from private.note_versions v where v.note_id=p_note and private.context_visible('note',p_note);
$$;
create function public.my_deleted_notes() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'excerpt',left(n.body,80),'calendar_id',n.calendar_id) order by n.deleted_at desc),'[]'::jsonb)
 from public.notes n where n.deleted_at is not null and private.can_edit_item(n.calendar_id,n.created_by);
$$;
revoke all on function public.note_versions(uuid),public.my_deleted_notes() from public,anon;
grant execute on function public.note_versions(uuid),public.my_deleted_notes() to authenticated;

-- A reserva mantém a ocorrência da tarefa em que foi criada, mesmo após avançar o prazo.
alter table public.events add column task_occurrence_date date;
create function private.stamp_task_occurrence() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select due_date into new.task_occurrence_date from public.tasks where id=new.task_id and recurrence_rule is not null;
 return new;
end; $$;
revoke all on function private.stamp_task_occurrence() from public,anon,authenticated;
create trigger stamp_block_on_insert before insert on public.events for each row execute function private.stamp_task_occurrence();
create trigger stamp_block_on_relink before update of task_id on public.events for each row when (new.task_id is distinct from old.task_id) execute function private.stamp_task_occurrence();
drop function public.list_events(uuid[],timestamptz,timestamptz);
create or replace function public.list_events(p_calendar_ids uuid[], p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, calendar_id uuid, title text, description text, location text, address text, url text,
  all_day boolean, starts_at timestamptz, ends_at timestamptz, start_date date, end_date date,
  timezone text, recurrence_rule text, created_by uuid, assignee_id uuid, color text,
  event_type text, status text, privacy text, version integer, created_at timestamptz,
  updated_at timestamptz, updated_by uuid, completed_at timestamptz, is_masked boolean,
  exceptions jsonb, attendee_ids uuid[], my_reminders integer[], task_id uuid, external_uid text, decoration text, task_occurrence_date date)
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
         case when v.access = 'full' then v.decoration end,
         case when v.access='full' then v.task_occurrence_date end
  from visible v
  where v.access is not null
  order by v.starts_at
  limit 5000;
$$;
revoke all on function public.list_events(uuid[],timestamptz,timestamptz) from public,anon;
grant execute on function public.list_events(uuid[],timestamptz,timestamptz) to authenticated;

-- Remover referências pessoais quando a participação que autorizava a leitura termina.
create function private.review_personal_references() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid:=old.user_id; cal uuid;
begin
 if tg_table_name='calendar_members' then cal:=old.calendar_id;
 elsif tg_table_name='task_participants' then select calendar_id into cal from public.tasks where id=old.task_id;
 else select calendar_id into cal from public.events where id=old.event_id;
 end if;
 update public.notes n set event_id=null from public.events e
 where n.created_by=u and n.calendar_id is null and e.id=n.event_id and e.calendar_id=cal and
   private.event_access_for((select role from public.calendar_members where calendar_id=cal and user_id=u and status='active'),u,e.id,e.created_by,e.privacy) is distinct from 'full';
 update public.notes n set task_id=null from public.tasks t
 where n.created_by=u and n.calendar_id is null and t.id=n.task_id and t.calendar_id=cal and
 not private.task_access_for(u,(select role from public.calendar_members where calendar_id=cal and user_id=u and status='active'),cal,t.id,t.created_by,t.assignee_id,t.privacy);
 update public.events e set task_id=null from public.tasks t where e.created_by=u and e.task_id=t.id and t.calendar_id=cal and
 not private.task_access_for(u,(select role from public.calendar_members where calendar_id=cal and user_id=u and status='active'),cal,t.id,t.created_by,t.assignee_id,t.privacy);
 return null;
end; $$;
revoke all on function private.review_personal_references() from public,anon,authenticated;
create trigger context_member_access after update of role,status or delete on public.calendar_members for each row execute function private.review_personal_references();
create trigger context_participant_access after delete on public.task_participants for each row execute function private.review_personal_references();
create trigger context_attendee_access after delete on public.event_attendees for each row execute function private.review_personal_references();

alter table public.habits add column schedule_history jsonb not null default '[]'::jsonb;
create function private.remember_habit_schedule() returns trigger language plpgsql set search_path='' as $$
declare effective date;
begin
 select (now() at time zone timezone)::date into effective from public.user_preferences where user_id=new.created_by;
 effective:=coalesce(effective,(now() at time zone 'UTC')::date);
 if not exists(select 1 from jsonb_array_elements(old.schedule_history) s where s->>'until'=effective::text) then
   new.schedule_history:=old.schedule_history||jsonb_build_array(jsonb_build_object('until',effective,'status',old.status,'start_date',old.start_date,'recurrence_rule',old.recurrence_rule));
 end if;
 return new;
end; $$;
create trigger habit_schedule_versions before update on public.habits for each row
 when(old.status is distinct from new.status or old.start_date is distinct from new.start_date or old.recurrence_rule is distinct from new.recurrence_rule)
 execute function private.remember_habit_schedule();
create or replace function private.habit_json(p_habit_id uuid, p_since date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(h) || jsonb_build_object('logs', coalesce((
    select jsonb_agg(jsonb_build_object('user_id', l.user_id, 'day', l.day) order by l.day desc)
    from public.habit_logs l where l.habit_id = h.id and (l.day >= p_since or l.user_id=auth.uid())), '[]'::jsonb))
  from public.habits h where h.id = p_habit_id;
$$;
