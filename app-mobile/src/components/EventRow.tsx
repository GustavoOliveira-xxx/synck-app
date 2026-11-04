import { EventCompletion } from './EventCompletion';
import { Decoration } from './DecorationPicker';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useNow } from '@/hooks/useNow';
import { t } from '@/i18n';
import type { DateFormat, Occurrence, TimeFormat } from '@/models/types';
import { useDataStore } from '@/stores/dataStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, elevation, radius, spacing } from '@/theme/tokens';
import { formatDateKey, formatTime, toDateKey } from '@/utils/dates';

import { AppText } from './AppText';
import { AvatarStack } from './Avatar';
import { Badge } from './Badge';
import { PressableScale } from './motion';

export interface EventRowProps {
  occurrence: Occurrence;
  calendarName?: string;
  calendarColor?: string;
  timezone: string;
  timeFormat?: TimeFormat;
  dateFormat?: DateFormat;
  conflict?: boolean;
  /** Mostrar a data no lugar do horário de término (listas de vários dias). */
  showDate?: boolean;
  onPress: (occurrence: Occurrence) => void;
}

/** Nomes e cores dos participantes, a partir dos membros já carregados. */
function usePeople(ids: string[]) {
  const members = useDataStore((s) => s.members);
  return useMemo(() => {
    if (!ids.length) return [];
    const byId = new Map<string, { name: string; color: string }>();
    for (const list of Object.values(members)) {
      for (const m of list) byId.set(m.user_id, { name: m.display_name, color: m.avatar_color });
    }
    return ids.map((id) => byId.get(id)).filter((p): p is { name: string; color: string } => !!p);
  }, [ids, members]);
}

/**
 * Cartão de evento SynCK: horário à esquerda (algarismos tabulares), barra de
 * 4 dp na cor da agenda, título, agenda, local e pilha de avatares. O evento
 * que está acontecendo agora ganha contorno `primary` e a etiqueta "Agora".
 */
export const EventRow = memo(function EventRow({
  occurrence: occ,
  calendarName,
  calendarColor,
  timezone,
  timeFormat,
  dateFormat,
  conflict,
  showDate,
  onPress,
}: EventRowProps) {
  const { colors, dark } = useAppTheme();
  const e = occ.event;
  const title = e.is_masked ? t('events.maskedTitle') : (occ.title ?? '');
  const cancelled = e.status === 'cancelled';
  const done = e.status === 'completed' || !!e.completed_at;
  const color = agendaColor(e.color ?? calendarColor, dark) ?? colors.primary;
  const nowMs = useNow();
  const isNow = !occ.allDay && !cancelled && occ.start.getTime() <= nowMs && occ.end.getTime() > nowMs;
  const people = usePeople(e.attendee_ids ?? []);

  const startKey = toDateKey(occ.start, timezone);
  const top = occ.allDay ? t('calendarView.allDay') : formatTime(occ.start, timezone, timeFormat);
  const bottom = occ.allDay
    ? showDate && occ.startDate
      ? formatDateKey(occ.startDate, dateFormat)
      : ''
    : showDate
      ? formatDateKey(startKey, dateFormat)
      : formatTime(occ.end, timezone, timeFormat);

  const labels = [
    isNow ? t('today.now') : null,
    title,
    occ.allDay ? t('calendarView.allDay') : `${top} às ${formatTime(occ.end, timezone, timeFormat)}`,
    calendarName,
    occ.location,
    cancelled ? t('events.cancelledBadge') : null,
    done ? t('eventStatus.completed') : null,
    occ.isRecurring ? t('events.recurring') : null,
    e.privacy === 'private' && !e.is_masked ? t('events.privateBadge') : null,
    e.privacy === 'busy' ? t('events.busyBadge') : null,
    e.privacy === 'participants' ? t('events.participantsBadge') : null,
    e.pending ? t('events.pendingBadge') : null,
    conflict ? t('calendarView.conflictBadge') : null,
  ].filter(Boolean);

  const badges = [
    cancelled && <Badge key="c" label={t('events.cancelledBadge')} tone="danger" />,
    conflict && (
      <Badge key="x" label={t('calendarView.conflictBadge')} tone="warning" icon="warning-outline" />
    ),
    e.pending && (
      <Badge key="p" label={t('events.pendingBadge')} tone="warning" icon="cloud-upload-outline" />
    ),
    e.privacy === 'busy' && <Badge key="b" label={t('events.busyBadge')} icon="eye-off-outline" />,
    !e.is_masked && e.privacy === 'private' && (
      <Badge key="v" label={t('events.privateBadge')} icon="lock-closed-outline" />
    ),
    e.privacy === 'participants' && (
      <Badge key="r" label={t('events.participantsBadge')} icon="people-outline" />
    ),
  ].filter(Boolean);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <PressableScale
        onPress={() => onPress(occ)}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={labels.join(', ')}
        style={[
          styles.card,
          { flex: 1 },
          occ.routine && { borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border },
          { backgroundColor: colors.surface },
          dark ? { borderColor: colors.border } : elevation(1, colors),
          isNow && { borderColor: colors.primary, borderWidth: 2 },
        ]}
      >
        <View style={styles.time}>
          <AppText variant="time" maxFontSizeMultiplier={1.3} style={occ.allDay && styles.allDay}>
            {top}
          </AppText>
          {bottom ? (
            <AppText variant="caption" tone="muted" maxFontSizeMultiplier={1.3} style={styles.tabular}>
              {bottom}
            </AppText>
          ) : null}
        </View>
        <View style={[styles.bar, { backgroundColor: color, opacity: cancelled ? 0.4 : 1 }]} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            {!e.is_masked && <Decoration name={e.decoration} color={color} size={22} />}
            <AppText
              variant="eventTitle"
              numberOfLines={1}
              style={[
                styles.flex,
                (cancelled || done) && { textDecorationLine: 'line-through', color: colors.textMuted },
              ]}
            >
              {title}
            </AppText>
            {isNow && <Badge label={t('today.now')} tone="strong" />}
          </View>
          {calendarName ? (
            <View style={styles.meta}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
                {calendarName}
                {occ.isRecurring ? ` · ${t('events.recurring')}` : ''}
              </AppText>
            </View>
          ) : null}
          {occ.location || people.length ? (
            <View style={styles.meta}>
              <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
                {occ.location ?? ''}
              </AppText>
              <AvatarStack people={people} size={26} />
            </View>
          ) : null}
          {badges.length ? <View style={styles.badges}>{badges}</View> : null}
        </View>
      </PressableScale>
      <EventCompletion occurrence={occ} compact />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  time: { width: 50, gap: 2, paddingTop: 1 },
  allDay: { fontSize: 11, lineHeight: 14 },
  tabular: { fontVariant: ['tabular-nums'] },
  bar: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 18 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
});
