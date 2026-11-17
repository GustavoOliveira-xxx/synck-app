-- Número no ícone do app (3.7.2): quantas tarefas e lembretes estão pendentes
-- para a pessoa hoje. Conta o mesmo que a visão "Hoje" da aba Tarefas:
-- abertos, com prazo até hoje (atrasados inclusive) ou planejados para hoje,
-- e só os que a pessoa enxerga (as mesmas regras de list_my_items).
-- Usado pela função enviar-push, que manda o número junto de cada notificação.
create or replace function private.badge_count(p_uid uuid, p_today date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.tasks t
  left join public.calendar_members m
    on m.calendar_id = t.calendar_id and m.user_id = p_uid and m.status = 'active'
  left join public.calendars c on c.id = t.calendar_id
  left join public.task_plans pl on pl.task_id = t.id and pl.user_id = p_uid
  where t.deleted_at is null
    and t.status in ('pending', 'in_progress', 'waiting')
    and (t.due_date <= p_today or pl.day = p_today)
    and ((t.calendar_id is null and t.created_by = p_uid)
         or (m.id is not null and c.deleted_at is null
             and private.task_access_for(p_uid, m.role, t.calendar_id, t.id, t.created_by, t.assignee_id, t.privacy)));
$$;

revoke all on function private.badge_count(uuid, date) from public, anon, authenticated;
