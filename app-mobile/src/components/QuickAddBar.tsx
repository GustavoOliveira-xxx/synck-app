import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { FadeIn, FadeOut } from 'react-native-reanimated';

import { MotionView } from './motion';

import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { strings, t } from '@/i18n';
import type { DateKey } from '@/models/types';
import { saveQuick } from '@/services/quickCreate';
import { useAuthStore } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { formatClock, formatShortDate, todayKey } from '@/utils/dates';
import { needsReview, parseQuickAdd, type QuickParse } from '@/utils/quickAdd';
import { describeRule, parseRule } from '@/utils/recurrence';

import { AppText } from './AppText';
import { useFeedback } from './Feedback';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

/** Pílulas com o que foi entendido do texto (tipo, data, horário, repetição...). */
export function ParsePreview({ parse, today }: { parse: QuickParse; today: DateKey }) {
  const { colors } = useAppTheme();
  const { timeFormat } = useDisplaySettings();
  const items: { icon: IconName; text: string }[] = [];
  const kindIcon: IconName =
    parse.kind === 'event'
      ? 'calendar-outline'
      : parse.kind === 'reminder'
        ? 'notifications-outline'
        : 'task-outline';
  items.push({ icon: kindIcon, text: strings.create[parse.kind] });
  if (parse.date) {
    items.push({
      icon: 'today-outline',
      text: parse.date === today ? t('common.today') : formatShortDate(parse.date),
    });
  }
  if (parse.time) {
    const clock = (v: string) => formatClock(Number(v.slice(0, 2)), Number(v.slice(3, 5)), timeFormat);
    items.push({
      icon: 'time-outline',
      text: parse.endTime ? `${clock(parse.time)} a ${clock(parse.endTime)}` : clock(parse.time),
    });
  }
  if (parse.recurrence) {
    const rule = parseRule(parse.recurrence.rule);
    if (rule) {
      const text = describeRule(rule, parse.date ?? today);
      items.push({
        icon: 'repeat',
        text: parse.recurrence.mode === 'completion' ? t('tasks.afterCompletion', { rule: text }) : text,
      });
    }
  }
  if (parse.priority) items.push({ icon: 'flag-outline', text: strings.tasks.priorities[parse.priority] });
  for (const tag of parse.tags) items.push({ icon: 'pricetag-outline', text: tag });
  return (
    <View style={styles.preview} accessibilityLiveRegion="polite">
      {items.map((item, i) => (
        <MotionView
          key={`${item.icon}-${item.text}`}
          entering={FadeIn.duration(140).delay(i * 30)}
          exiting={FadeOut.duration(80)}
          style={[styles.pill, { backgroundColor: colors.primarySoft }]}
        >
          <Icon name={item.icon} size={14} color={colors.primaryInk} />
          <AppText variant="caption" style={{ color: colors.primaryInk }}>
            {item.text}
          </AppText>
        </MotionView>
      ))}
    </View>
  );
}

/** Campo de adição rápida: escreve, confere a prévia e salva com Enter. */
export function QuickAddBar({
  listId = null,
  calendarId = null,
  planDay = null,
  placeholder,
  onSaved,
}: {
  listId?: string | null;
  calendarId?: string | null;
  planDay?: DateKey | null;
  placeholder?: string;
  onSaved?: () => void;
}) {
  const { colors } = useAppTheme();
  const { toast } = useFeedback();
  const display = useDisplaySettings();
  const calendars = useDataStore((s) => s.calendars);
  const defaultReminder = useAuthStore(
    (s) => s.account?.notification_preferences.default_reminder_minutes ?? null,
  );
  const online = useSyncStore((s) => s.online);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const today = todayKey(display.timezone);
  const parse = useMemo(() => (text.trim() ? parseQuickAdd(text, today) : null), [text, today]);

  const submit = async () => {
    if (!parse) return;
    if (needsReview(parse)) {
      router.push({
        pathname: '/create',
        params: { text, listId: listId ?? '', calendarId: calendarId ?? '' },
      });
      setText('');
      return;
    }
    const saved = await saveQuick(parse, calendars, {
      timezone: display.timezone,
      listId,
      calendarId,
      planDay,
      defaultReminder,
    });
    if (!saved) {
      toast(t('create.noCalendar'), 'error');
      return;
    }
    setText('');
    onSaved?.();
    const message =
      saved.kind === 'event'
        ? t('events.created')
        : saved.kind === 'reminder'
          ? t('tasks.reminderCreated')
          : t('tasks.created');
    toast(online ? message : t('events.savedOffline'));
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.field,
          { backgroundColor: colors.surface, borderColor: focused ? colors.primary : colors.inputBorder },
        ]}
      >
        <Icon name="add" size={20} color={colors.primaryInk} />
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={() => void submit()}
          placeholder={placeholder ?? t('tasks.quickPlaceholder')}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          blurOnSubmit={false}
          maxLength={300}
          accessibilityLabel={t('create.quickLabel')}
          accessibilityHint={t('create.quickHint')}
          style={[styles.input, typography.bodyMd, { color: colors.text }]}
          testID="quick-add"
        />
        {text.trim() ? (
          <IconButton
            icon="send"
            label={t('create.save')}
            onPress={() => void submit()}
            color={colors.primary}
          />
        ) : null}
      </View>
      {parse && <ParsePreview parse={parse} today={today} />}
      {parse && needsReview(parse) && (
        <AppText variant="caption" tone="warning">
          {parse.ambiguities[0]}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.sm + 4,
    paddingLeft: spacing.md,
    minHeight: MIN_TOUCH + 4,
  },
  input: { flex: 1, paddingVertical: spacing.sm, ...fonte('medio') },
  preview: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
