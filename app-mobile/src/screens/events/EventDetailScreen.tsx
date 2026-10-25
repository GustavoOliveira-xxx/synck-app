import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { StarBurst } from '@/components/brand/Decor';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { EnterItem, PressableScale, tapFeedback } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useCalendarMembers } from '@/hooks/useCalendarMembers';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useNow } from '@/hooks/useNow';
import { useCalendarsMap, useEventsMap } from '@/hooks/useEventsView';
import { useRemoteData } from '@/hooks/useRemoteData';
import { strings, t } from '@/i18n';
import type { CalendarEvent, EventStatus, Member, Occurrence } from '@/models/types';
import * as api from '@/services/api';
import { goBack } from '@/services/navigation';
import { shareMessage } from '@/services/share';
import {
  deleteEvent,
  duplicateEvent,
  restoreEvent,
  setEventStatus,
  setReminders,
  type RecurrenceScope,
} from '@/services/eventActions';
import { useUserId } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, fonte, radius, SCREEN_MARGIN, spacing } from '@/theme/tokens';
import { describeActivity } from '@/utils/activity';
import { capitalize, formatDateTime, formatLongDate, formatOccurrenceTime, toDateKey } from '@/utils/dates';
import { canComment, canEditEvent } from '@/utils/permissions';
import { describeRule, expandEvent, parseRule } from '@/utils/recurrence';

import { ReminderPicker } from './ReminderPicker';

function findOccurrence(event: CalendarEvent, date?: string): Occurrence | undefined {
  if (date) {
    const day = new Date(`${date}T00:00:00Z`);
    const found = expandEvent(
      event,
      new Date(day.getTime() - 2 * 86_400_000),
      new Date(day.getTime() + 3 * 86_400_000),
    ).find((o) => o.originalDate === date);
    if (found) return found;
  }
  const start = new Date(event.starts_at);
  return expandEvent(event, start, new Date(start.getTime() + 400 * 86_400_000))[0];
}

/** "1h 12min", "45 min" ou "3 dias". */
function formatSpan(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  }
  return `${Math.round(minutes / 1440)} dias`;
}

const RESPONSE_TONE = {
  accepted: 'primary',
  tentative: 'warning',
  declined: 'danger',
  pending: 'neutral',
} as const;

/** "Você vai?": Vou, Talvez, Não vou. "Vou" estoura estrelas. */
function Rsvp({ event, userId }: { event: CalendarEvent; userId: string }) {
  const { colors } = useAppTheme();
  const online = useSyncStore((s) => s.online);
  const { run } = useAction();
  const { data, reload } = useRemoteData(
    () =>
      online && event.version > 0
        ? api.listAttendeeResponses(event.id)
        : Promise.resolve({} as Record<string, api.AttendeeResponse>),
    [event.id, online, event.version],
    {} as Record<string, api.AttendeeResponse>,
  );
  const [burst, setBurst] = useState(0);
  const mine = data?.[userId] ?? 'pending';
  const answer = async (response: api.AttendeeResponse) => {
    if (response === mine) return;
    if (response === 'accepted') {
      tapFeedback('success');
      setBurst((b) => b + 1);
    } else tapFeedback('select');
    const result = await run(() => api.setMyResponse(event.id, userId, response), {
      success: t('events.rsvpSaved'),
    });
    if (result.ok) void reload();
  };
  const options: { value: api.AttendeeResponse; label: string }[] = [
    { value: 'accepted', label: t('events.rsvpGoing') },
    { value: 'tentative', label: t('events.rsvpMaybe') },
    { value: 'declined', label: t('events.rsvpNo') },
  ];
  return (
    <View style={styles.gap}>
      <SectionHeader title={t('events.rsvpTitle')} />
      <View style={styles.rsvpRow} accessibilityRole="radiogroup" accessibilityLabel={t('events.rsvpTitle')}>
        {options.map((o) => {
          const selected = mine === o.value;
          return (
            <PressableScale
              key={o.value}
              onPress={() => void answer(o.value)}
              disabled={!online}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: !online }}
              accessibilityLabel={o.label}
              style={[
                styles.rsvp,
                selected
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { borderColor: colors.inputBorder },
                !online && { opacity: 0.5 },
              ]}
            >
              {selected && <Icon name="checkmark" size={18} color={colors.primaryText} />}
              <AppText style={[fonte('negrito'), { color: selected ? colors.primaryText : colors.text }]}>
                {o.label}
              </AppText>
              {o.value === 'accepted' && <StarBurst trigger={burst} size={64} />}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** Participantes com a resposta de cada um. */
function Participants({
  event,
  people,
  onOpen,
}: {
  event: CalendarEvent;
  people: Member[];
  onOpen: () => void;
}) {
  const online = useSyncStore((s) => s.online);
  const { data } = useRemoteData(
    () =>
      online && event.version > 0 && event.attendee_ids.length
        ? api.listAttendeeResponses(event.id)
        : Promise.resolve({} as Record<string, api.AttendeeResponse>),
    [event.id, online, event.version, event.attendee_ids.length],
    {} as Record<string, api.AttendeeResponse>,
  );
  const list = event.attendee_ids.map((id) => {
    const m = people.find((p) => p.user_id === id);
    return { id, name: m?.display_name ?? t('common.someone'), color: m?.avatar_color ?? '', me: !!m?.is_me };
  });
  const confirmed = list.filter((p) => data?.[p.id] === 'accepted').length;
  return (
    <View style={styles.gap}>
      <SectionHeader
        title={list.length ? `${t('events.participants')} · ${list.length}` : t('events.participants')}
        right={
          list.length ? (
            <AppText variant="caption" tone="muted">
              {t('events.confirmedCount', { n: confirmed })}
            </AppText>
          ) : undefined
        }
      />
      {list.map((p, i) => {
        const response = data?.[p.id] ?? 'pending';
        return (
          <EnterItem key={p.id} index={i} style={styles.person}>
            <Avatar name={p.name} color={p.color} size={36} />
            <AppText style={[styles.flex, fonte('semi')]}>
              {p.me ? `${p.name} (${t('common.you').toLowerCase()})` : p.name}
            </AppText>
            <Badge label={strings.events.rsvpStatus[response]} tone={RESPONSE_TONE[response]} />
          </EnterItem>
        );
      })}
      <Button
        title={t('events.participants')}
        icon="people-outline"
        variant="ghost"
        compact
        onPress={onOpen}
      />
    </View>
  );
}

function Comments({ event, canWrite }: { event: CalendarEvent; canWrite: boolean }) {
  const display = useDisplaySettings();
  const online = useSyncStore((s) => s.online);
  const { run, busy } = useAction();
  const { confirm } = useFeedback();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const isPending = event.version === 0;
  const { data, reload } = useRemoteData(
    () => (online && !isPending ? api.listComments(event.id) : Promise.resolve([])),
    [event.id, online, isPending],
    [],
  );

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const result = await run(() =>
      editing ? api.editComment(editing, body) : api.addComment(event.id, body),
    );
    if (result.ok) {
      setText('');
      setEditing(null);
      void reload();
    }
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: t('events.deleteComment'),
      destructive: true,
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    const result = await run(() => api.deleteComment(id));
    if (result.ok) void reload();
  };

  return (
    <View style={styles.gap}>
      <SectionHeader title={t('events.comments')} />
      {!online ? <AppText tone="muted">{t('events.commentsOffline')}</AppText> : null}
      {online && !data?.length ? <AppText tone="muted">{t('events.noComments')}</AppText> : null}
      {data?.map((c) => (
        <Card key={c.id}>
          <View style={styles.row}>
            <Avatar name={c.author_name} color={c.author_color} size={32} />
            <View style={styles.flex}>
              <AppText variant="label">{c.is_mine ? t('common.you') : c.author_name}</AppText>
              <AppText variant="caption" tone="muted">
                {formatDateTime(
                  new Date(c.created_at),
                  display.timezone,
                  display.dateFormat,
                  display.timeFormat,
                )}
                {c.edited_at ? ` ${t('events.edited')}` : ''}
              </AppText>
            </View>
          </View>
          <AppText tone={c.deleted_at ? 'muted' : 'default'} selectable>
            {c.deleted_at ? t('events.commentDeleted') : c.body}
          </AppText>
          {c.is_mine && !c.deleted_at && canWrite && (
            <View style={styles.row}>
              <Button
                title={t('common.edit')}
                variant="ghost"
                compact
                onPress={() => {
                  setEditing(c.id);
                  setText(c.body ?? '');
                }}
              />
              <Button title={t('common.delete')} variant="ghost" compact onPress={() => remove(c.id)} />
            </View>
          )}
        </Card>
      ))}
      {canWrite && online && !isPending && (
        <>
          <TextField
            label={t('events.commentPlaceholder')}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
          />
          <Button
            title={editing ? t('common.save') : t('events.send')}
            icon="send"
            onPress={send}
            loading={busy}
            compact
          />
        </>
      )}
    </View>
  );
}

function EventHistory({ event }: { event: CalendarEvent }) {
  const display = useDisplaySettings();
  const userId = useUserId();
  const online = useSyncStore((s) => s.online);
  const [open, setOpen] = useState(false);
  const { data } = useRemoteData(
    () =>
      open && online
        ? api.listActivity(event.calendar_id, { eventId: event.id, limit: 20 })
        : Promise.resolve([]),
    [open, online, event.id],
    [],
  );
  return (
    <View style={styles.gap}>
      <Button
        title={t('events.history')}
        icon={open ? 'chevron-up' : 'time-outline'}
        variant="ghost"
        compact
        onPress={() => setOpen((o) => !o)}
      />
      {open &&
        data?.map((entry) => (
          <AppText key={entry.id} variant="small" tone="muted">
            {formatDateTime(
              new Date(entry.created_at),
              display.timezone,
              display.dateFormat,
              display.timeFormat,
            )}{' '}
            · {describeActivity(entry, userId)}
          </AppText>
        ))}
    </View>
  );
}

export default function EventDetailScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const { colors, dark } = useAppTheme();
  const display = useDisplaySettings();
  const userId = useUserId();
  const now = useNow(30_000);
  const { confirm, toast } = useFeedback();
  const events = useEventsMap();
  const calendars = useCalendarsMap();
  const event = events[id];
  const people = useCalendarMembers(event?.calendar_id);
  const occurrence = useMemo(() => (event ? findOccurrence(event, date) : undefined), [event, date]);
  const [reminders, setReminderState] = useState<number[] | null>(null);

  if (!event || !occurrence) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('events.details') }} />
        <EmptyState icon="alert-circle-outline" title={t('events.notFound')} />
      </Screen>
    );
  }

  const calendar = calendars[event.calendar_id];
  const editable = !!calendar && canEditEvent(calendar, event, userId);
  const rule = parseRule(event.recurrence_rule);
  const nameOf = (uid: string | null) =>
    !uid
      ? t('common.exMember')
      : uid === userId
        ? t('common.you')
        : (people.find((p) => p.user_id === uid)?.display_name ?? t('common.someone'));
  const title = event.is_masked ? t('events.maskedTitle') : (occurrence.title ?? '');
  const time = formatOccurrenceTime(occurrence, display.timezone, display.timeFormat, display.dateFormat);
  // Evento de um dia só: mostra a data por extenso (eventos de vários dias já trazem as datas no horário).
  const startKey = occurrence.allDay ? occurrence.startDate : toDateKey(occurrence.start, display.timezone);
  const endKey = occurrence.allDay
    ? occurrence.endDate
    : toDateKey(new Date(occurrence.end.getTime() - 1), display.timezone);
  const dateLabel = startKey && startKey === endKey ? capitalize(formatLongDate(startKey, true)) : null;
  const eventZoneTime =
    !event.all_day && event.timezone !== display.timezone
      ? `${formatOccurrenceTime(occurrence, event.timezone, display.timeFormat, display.dateFormat)} (${event.timezone})`
      : null;

  const askScope = async (kind: 'edit' | 'delete'): Promise<RecurrenceScope | null> => {
    if (!rule) return 'all';
    const choice = await confirm({
      title: t('recurrence.editScopeTitle'),
      message: kind === 'edit' ? t('recurrence.editScopeMessage') : t('recurrence.deleteScopeMessage'),
      choices: [
        { value: 'this', label: t('recurrence.scopeThis'), destructive: kind === 'delete' },
        { value: 'following', label: t('recurrence.scopeFollowing'), destructive: kind === 'delete' },
        { value: 'all', label: t('recurrence.scopeAll'), destructive: kind === 'delete' },
      ],
    });
    return typeof choice === 'string' ? (choice as RecurrenceScope) : null;
  };

  const edit = async () => {
    const scope = await askScope('edit');
    if (!scope) return;
    router.push({
      pathname: '/event/[id]/edit',
      params: { id: event.id, date: occurrence.originalDate, scope },
    });
  };

  const remove = async () => {
    const scope = await askScope('delete');
    if (!scope) return;
    if (!rule) {
      const ok = await confirm({
        title: t('events.deleteTitle'),
        message: t('events.deleteMessage'),
        destructive: true,
        confirmLabel: t('common.delete'),
      });
      if (!ok) return;
    }
    await deleteEvent(event, scope, occurrence);
    const canUndo = scope === 'all' && event.version > 0;
    toast(
      t('events.deleted'),
      'success',
      canUndo ? { label: t('events.undo'), onPress: () => void restoreEvent(event) } : undefined,
    );
    goBack();
  };

  const changeStatus = async (status: EventStatus, message: string) => {
    await setEventStatus(event, status);
    toast(message);
  };

  const duplicate = async () => {
    const newId = await duplicateEvent(event, occurrence);
    toast(t('events.duplicated'));
    router.replace({ pathname: '/event/[id]/edit', params: { id: newId, scope: 'all' } });
  };

  const share = async () => {
    const message = [title, dateLabel, time, occurrence.location, event.url].filter(Boolean).join('\n');
    if ((await shareMessage(message)) === 'copied') toast(t('common.copiedToShare'));
  };

  const saveReminders = async () => {
    if (!reminders) return;
    await setReminders(event, reminders);
    setReminderState(null);
    toast(t('common.saved'));
  };

  const color = agendaColor(event.color ?? calendar?.color, dark) ?? colors.primary;
  const startMs = occurrence.start.getTime();
  const endMs = occurrence.end.getTime();
  const isNow = !occurrence.allDay && event.status !== 'cancelled' && startMs <= now && endMs > now;
  const soon = !occurrence.allDay && startMs > now && startMs - now < 24 * 3600_000;
  const amAttendee = !!userId && event.attendee_ids.includes(userId);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t('events.details'),
          headerTitle: '',
          headerStyle: { backgroundColor: colors.surface },
        }}
      />
      <View style={[styles.hero, { backgroundColor: colors.surface }]}>
        <View style={styles.chips}>
          <View style={[styles.calChip, { borderColor: colors.border }]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <AppText variant="label">{calendar?.name}</AppText>
          </View>
          {isNow && <Badge label={t('today.now')} tone="strong" />}
          {event.status !== 'planned' && event.status !== 'confirmed' && (
            <Badge
              label={strings.eventStatus[event.status]}
              tone={
                event.status === 'cancelled' ? 'danger' : event.status === 'completed' ? 'success' : 'neutral'
              }
            />
          )}
        </View>
        <AppText
          variant="display"
          selectable
          style={[styles.heroTitle, event.status === 'cancelled' && { textDecorationLine: 'line-through' }]}
        >
          {title}
        </AppText>
        <View style={styles.row}>
          <Icon name="time-outline" size={22} color={colors.text} />
          <View style={styles.flex}>
            {dateLabel ? <AppText style={fonte('semi')}>{dateLabel}</AppText> : null}
            <AppText style={dateLabel ? undefined : fonte('semi')}>{time}</AppText>
            {isNow ? (
              <AppText variant="caption" tone="muted">
                {t('events.endsIn', { time: formatSpan(endMs - now) })}
              </AppText>
            ) : soon ? (
              <AppText variant="caption" tone="muted">
                {t('events.startsIn', { time: formatSpan(startMs - now) })}
              </AppText>
            ) : null}
          </View>
        </View>
        {eventZoneTime ? (
          <AppText variant="small" tone="muted">
            {eventZoneTime}
          </AppText>
        ) : null}
        {!event.is_masked && occurrence.location ? (
          <View style={styles.row}>
            <Icon name="location-outline" size={22} color={colors.text} />
            <AppText style={styles.flex} selectable>
              {occurrence.location}
            </AppText>
          </View>
        ) : null}
        {rule ? (
          <View style={styles.row}>
            <Icon name="repeat" size={22} color={colors.text} />
            <AppText style={styles.flex}>{describeRule(rule, occurrence.originalDate)}</AppText>
          </View>
        ) : null}
        <View style={styles.badges}>
          {!event.is_masked && <Badge label={strings.eventTypes[event.event_type]} />}
          {event.privacy !== 'members' && (
            <Badge label={strings.privacy[event.privacy]} icon="lock-closed-outline" />
          )}
          {occurrence.isException && <Badge label={t('events.exception')} tone="warning" />}
          {event.pending && (
            <Badge label={t('events.pendingBadge')} tone="warning" icon="cloud-upload-outline" />
          )}
        </View>
      </View>

      {amAttendee && !event.is_masked && userId ? <Rsvp event={event} userId={userId} /> : null}

      {event.is_masked ? (
        <AppText tone="muted">{t('events.maskedMessage')}</AppText>
      ) : (
        <>
          {event.address ? (
            <Card>
              <View style={styles.row}>
                <Icon name="location-outline" size={20} color={colors.textMuted} />
                <AppText tone="muted" selectable style={styles.flex}>
                  {event.address}
                </AppText>
              </View>
            </Card>
          ) : null}
          {event.url ? (
            <Button
              title={t('events.openLink')}
              icon="open-outline"
              variant="secondary"
              onPress={() => Linking.openURL(event.url!)}
            />
          ) : null}
          {occurrence.description ? (
            <Card>
              <AppText selectable>{occurrence.description}</AppText>
            </Card>
          ) : null}
          <Participants
            event={event}
            people={people}
            onOpen={() => router.push({ pathname: '/event/[id]/participants', params: { id: event.id } })}
          />
          <Card>
            {event.assignee_id ? (
              <AppText>
                {t('events.assignee')}: {nameOf(event.assignee_id)}
              </AppText>
            ) : null}
            <AppText variant="small" tone="muted">
              {t('events.createdBy', { name: nameOf(event.created_by) })}
            </AppText>
            <AppText variant="small" tone="muted">
              {t('events.updatedAt', {
                date: formatDateTime(
                  new Date(event.updated_at),
                  display.timezone,
                  display.dateFormat,
                  display.timeFormat,
                ),
              })}
            </AppText>
          </Card>
        </>
      )}

      <Card>
        <ReminderPicker value={reminders ?? event.my_reminders} onChange={setReminderState} />
        {reminders && <Button title={t('common.save')} onPress={saveReminders} compact />}
      </Card>

      {editable ? (
        <View style={styles.gap}>
          <Button title={t('common.edit')} icon="create-outline" onPress={edit} testID="event-edit" />
          {event.status !== 'completed' ? (
            <Button
              title={t('events.markDone')}
              icon="checkmark-done-outline"
              variant="secondary"
              onPress={() => changeStatus('completed', t('events.markedDone'))}
            />
          ) : (
            <Button
              title={t('events.reopen')}
              icon="refresh"
              variant="secondary"
              onPress={() => changeStatus('confirmed', t('common.saved'))}
            />
          )}
          {event.status !== 'cancelled' && (
            <Button
              title={t('events.cancelEvent')}
              icon="close-circle-outline"
              variant="secondary"
              onPress={() => changeStatus('cancelled', t('events.cancelled'))}
            />
          )}
          <Button title={t('events.duplicate')} icon="copy-outline" variant="secondary" onPress={duplicate} />
          <Button title={t('events.share')} icon="share-social-outline" variant="secondary" onPress={share} />
          <Button
            title={t('common.delete')}
            icon="trash-outline"
            variant="danger"
            onPress={remove}
            testID="event-delete"
          />
        </View>
      ) : (
        <>
          {!event.is_masked && (
            <Button
              title={t('events.share')}
              icon="share-social-outline"
              variant="secondary"
              onPress={share}
            />
          )}
          <AppText tone="muted">{t('events.readOnlyNotice')}</AppText>
        </>
      )}

      {event.task_id && !event.is_masked && (
        <Card onPress={() => router.push({ pathname: '/task/[id]', params: { id: event.task_id! } })}>
          <AppText variant="label">{t('events.blockOf')}</AppText>
          <AppText tone="brand">{t('events.openTask')}</AppText>
        </Card>
      )}

      {!event.is_masked && calendar && (
        <>
          <Comments event={event} canWrite={canComment(calendar)} />
          <EventHistory event={event} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  hero: {
    marginHorizontal: -SCREEN_MARGIN,
    marginTop: -spacing.lg,
    paddingHorizontal: SCREEN_MARGIN,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    gap: spacing.md,
  },
  heroTitle: { marginBottom: spacing.xs },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  calChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  rsvpRow: { flexDirection: 'row', gap: spacing.sm },
  rsvp: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gap: { gap: spacing.sm },
});
