// Função "enviar-push": notificações do SynCK no navegador (iPhone e computador).
//
// O agendamento do banco (pg_cron) chama esta função a cada minuto. Ela envia:
// - os lembretes de eventos que vencem desde a última rodada (mesma regra do app Android);
// - os alertas de tarefas e lembretes avulsos (prazo, ou 9h do dia sem horário);
// - os avisos novos (evento criado, alterado, convite, comentário, tarefa, enquete...).
//
// As chaves VAPID são criadas aqui na primeira rodada e ficam só no banco
// (private.web_push_config). Quem chama precisa mandar o segredo do agendamento.
import postgres from 'npm:postgres@3.4.5';
import webpush from 'npm:web-push@3.6.7';

import { t } from './logica/i18n/index.ts';
import type { CalendarEvent } from './logica/models/types.ts';
import { formatDateKey, formatOccurrenceTime, isWithinQuietHours, localToInstant } from './logica/utils/dates.ts';
import { expandEvent } from './logica/utils/recurrence.ts';
import { reminderTitle } from './logica/utils/reminders.ts';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 });

/** Janela máxima olhada para trás (se a função ficou parada, não dispara tudo de uma vez). */
const MAX_BACKLOG_MS = 15 * 60_000;

interface Push {
  userId: string;
  title: string;
  body: string;
  /** Caminho dentro do site (ex.: event/<id>), aberto ao tocar. */
  path: string;
  tag: string;
  silent: boolean;
}

interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function reminders(from: Date, to: Date): Promise<Push[]> {
  const rows = await sql<
    {
      user_id: string;
      minutes_before: number;
      event: CalendarEvent;
      access: string;
      sound: boolean;
      show_details: boolean;
      timezone: string;
      time_format: '24h' | '12h';
      quiet_start: string | null;
      quiet_end: string | null;
    }[]
  >`
    select r.user_id, r.minutes_before,
           to_jsonb(e) || jsonb_build_object('exceptions', coalesce(
             (select jsonb_agg(to_jsonb(x)) from public.recurrence_exceptions x where x.event_id = e.id), '[]'::jsonb))
             as event,
           private.event_access_for(cm.role, r.user_id, e.id, e.created_by, e.privacy) as access,
           np.sound, np.show_details_on_lock_screen as show_details,
           up.timezone, up.time_format,
           np.quiet_hours_start::text as quiet_start, np.quiet_hours_end::text as quiet_end
      from public.reminders r
      join public.events e on e.id = r.event_id and e.deleted_at is null
                          and e.status not in ('cancelled', 'completed', 'archived')
      join public.calendars c on c.id = e.calendar_id and c.deleted_at is null
      join public.calendar_members cm on cm.calendar_id = c.id and cm.user_id = r.user_id and cm.status = 'active'
      join public.notification_preferences np on np.user_id = r.user_id and np.enabled and np.notify_reminders
      join public.user_preferences up on up.user_id = r.user_id
     where exists (select 1 from public.push_subscriptions s where s.user_id = r.user_id)
       and (e.recurrence_rule is not null
            or e.starts_at - make_interval(mins => r.minutes_before) > ${from}
               and e.starts_at - make_interval(mins => r.minutes_before) <= ${to})`;

  const pushes: Push[] = [];
  for (const row of rows) {
    if (!row.access) continue;
    const ms = row.minutes_before * 60_000;
    // Ocorrências que começam dentro da janela deslocada pela antecedência.
    const occurrences = expandEvent(row.event, new Date(from.getTime() + ms - 86_400_000), new Date(to.getTime() + ms + 1));
    for (const occ of occurrences) {
      if (occ.event.status === 'completed' || occ.event.status === 'cancelled') continue;
      const at = occ.start.getTime() - ms;
      if (at <= from.getTime() || at > to.getTime()) continue;
      const details = row.show_details && row.access === 'full';
      const name = row.access === 'masked' ? t('events.maskedTitle') : (occ.title ?? '');
      pushes.push({
        userId: row.user_id,
        title: details ? reminderTitle(name, row.minutes_before) : t('reminders.lockedContent'),
        body: details
          ? [formatOccurrenceTime(occ, row.timezone, row.time_format), occ.location].filter(Boolean).join(' · ')
          : t('reminders.lockedBody'),
        path: `event/${row.event.id}?date=${occ.originalDate}`,
        tag: `rem:${occ.key}:${row.minutes_before}`,
        silent: !row.sound || isWithinQuietHours(new Date(at), row.timezone, row.quiet_start, row.quiet_end),
      });
    }
  }
  return pushes;
}

/** Sem horário no prazo, o alerta usa 9h do dia (igual ao app). */
const DEFAULT_ALERT_TIME = '09:00';

async function taskAlerts(from: Date, to: Date): Promise<Push[]> {
  const rows = await sql<
    {
      user_id: string;
      minutes_before: number;
      task_id: string;
      title: string;
      due_date: string;
      due_time: string | null;
      task_timezone: string;
      access: boolean;
      sound: boolean;
      show_details: boolean;
      timezone: string;
      time_format: '24h' | '12h';
      quiet_start: string | null;
      quiet_end: string | null;
    }[]
  >`
    select a.user_id, a.minutes_before, t.id as task_id, t.title, t.due_date::text, t.due_time::text,
           t.timezone as task_timezone,
           private.task_access_for(a.user_id, cm.role, t.calendar_id, t.id, t.created_by, t.assignee_id, t.privacy)
             as access,
           np.sound, np.show_details_on_lock_screen as show_details,
           up.timezone, up.time_format,
           np.quiet_hours_start::text as quiet_start, np.quiet_hours_end::text as quiet_end
      from public.task_alerts a
      join public.tasks t on t.id = a.task_id and t.deleted_at is null and t.due_date is not null
                         and t.status not in ('done', 'cancelled')
      left join public.calendars c on c.id = t.calendar_id
      left join public.calendar_members cm on cm.calendar_id = t.calendar_id and cm.user_id = a.user_id
                                          and cm.status = 'active'
      join public.notification_preferences np on np.user_id = a.user_id and np.enabled and np.notify_reminders
      join public.user_preferences up on up.user_id = a.user_id
     where exists (select 1 from public.push_subscriptions s where s.user_id = a.user_id)
       and (t.calendar_id is null or (c.deleted_at is null and cm.id is not null))
       and t.due_date between (${from}::timestamptz - interval '2 days')::date
                          and (${to}::timestamptz + interval '30 days')::date`;

  const pushes: Push[] = [];
  for (const row of rows) {
    if (!row.access) continue;
    const time = row.due_time?.slice(0, 5) ?? null;
    const base = localToInstant(row.due_date, time ?? DEFAULT_ALERT_TIME, row.task_timezone);
    const at = base.getTime() - row.minutes_before * 60_000;
    if (at <= from.getTime() || at > to.getTime()) continue;
    const when = [formatDateKey(row.due_date), time].filter(Boolean).join(' ');
    pushes.push({
      userId: row.user_id,
      title: row.show_details ? (time ? reminderTitle(row.title, row.minutes_before) : row.title) : t('reminders.lockedContent'),
      body: row.show_details ? when : t('reminders.lockedBody'),
      path: `task/${row.task_id}`,
      tag: `task:${row.task_id}:${row.due_date}:${row.minutes_before}`,
      silent: !row.sound || isWithinQuietHours(new Date(at), row.timezone, row.quiet_start, row.quiet_end),
    });
  }
  return pushes;
}

/** Caminho aberto ao tocar num aviso. */
function noticePath(n: { type: string; event_id: string | null; calendar_id: string | null; data: Record<string, unknown> }) {
  if (n.type === 'invite_received') return 'invites';
  if (typeof n.data.task_id === 'string') return `task/${n.data.task_id}`;
  if (typeof n.data.poll_id === 'string' && n.calendar_id) return `calendar/${n.calendar_id}/polls`;
  if (n.event_id && n.type !== 'event_deleted') return `event/${n.event_id}`;
  if (n.calendar_id && n.type !== 'member_removed') return `calendar/${n.calendar_id}`;
  return 'notifications';
}

async function notices(from: Date, to: Date): Promise<Push[]> {
  const rows = await sql<
    {
      id: string;
      user_id: string;
      timezone: string;
      quiet_start: string | null;
      quiet_end: string | null;
      type: string;
      title: string;
      body: string | null;
      event_id: string | null;
      calendar_id: string | null;
      data: Record<string, unknown>;
      sound: boolean;
      show_details: boolean;
    }[]
  >`
    select n.id, n.user_id, n.type, n.title, n.body, n.event_id, n.calendar_id, n.data, up.timezone,
           np.quiet_hours_start::text as quiet_start, np.quiet_hours_end::text as quiet_end,
           np.sound, np.show_details_on_lock_screen as show_details
      from public.notifications n
      join public.user_preferences up on up.user_id=n.user_id
      join public.notification_preferences np on np.user_id = n.user_id and np.enabled
     where n.created_at > ${from} and n.created_at <= ${to} and n.read_at is null
       and exists (select 1 from public.push_subscriptions s where s.user_id = n.user_id)`;
  return rows.map((n) => ({
    userId: n.user_id,
    title: n.show_details ? n.title : t('reminders.lockedContent'),
    body: n.show_details ? (n.body ?? '') : t('reminders.lockedBody'),
    path: noticePath(n),
    tag: `aviso:${n.id}`,
    silent: !n.sound || isWithinQuietHours(to, n.timezone, n.quiet_start, n.quiet_end),
  }));
}

async function send(pushes: Push[]): Promise<{ sent: number; removed: number }> {
  if (!pushes.length) return { sent: 0, removed: 0 };
  const users = [...new Set(pushes.map((p) => p.userId))];
  const subs = await sql<Subscription[]>`
    select id, user_id, endpoint, p256dh, auth from public.push_subscriptions where user_id = any(${users})`;
  let sent = 0;
  let removed = 0;
  await Promise.all(
    pushes.flatMap((push) =>
      subs
        .filter((s) => s.user_id === push.userId)
        .map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: push.title, body: push.body, path: push.path, tag: push.tag, silent: push.silent }),
              { TTL: 3600, urgency: 'high' },
            );
            sent++;
            await sql`update public.push_subscriptions set last_success_at = now() where id = ${s.id}`;
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            // Navegador desinstalado ou permissão retirada: a inscrição não vale mais.
            if (status === 404 || status === 410) {
              removed++;
              await sql`delete from public.push_subscriptions where id = ${s.id}`;
            } else {
              console.error('falha ao enviar', status, (error as Error).message);
            }
          }
        }),
    ),
  );
  return { sent, removed };
}

Deno.serve(async (req) => {
  const [config] = await sql<
    { public_key: string | null; private_key: string | null; subject: string; cron_secret: string }[]
  >`select public_key, private_key, subject, cron_secret from private.web_push_config where id`;
  if (!config || req.headers.get('x-synck-cron') !== config.cron_secret) {
    return new Response('forbidden', { status: 403 });
  }

  let { public_key: publicKey, private_key: privateKey } = config;
  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    await sql`update private.web_push_config set public_key = ${publicKey}, private_key = ${privateKey} where id`;
  }
  webpush.setVapidDetails(config.subject, publicKey, privateKey);

  // Marca a rodada (com trava: duas chamadas ao mesmo tempo não repetem envios).
  const to = new Date();
  const [{ previous }] = await sql<{ previous: Date | null }[]>`
    with antes as (select last_run_at from private.web_push_config where id for update)
    update private.web_push_config c set last_run_at = ${to} from antes where c.id
    returning antes.last_run_at as previous`;
  const from = new Date(Math.max(previous ? previous.getTime() : to.getTime() - 60_000, to.getTime() - MAX_BACKLOG_MS));

  const pushes = [...(await reminders(from, to)), ...(await taskAlerts(from, to)), ...(await notices(from, to))];
  const result = await send(pushes);
  return Response.json({ from, to, ...result });
});
