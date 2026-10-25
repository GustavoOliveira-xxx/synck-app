// "O que você deseja adicionar?": adição rápida (texto livre) com prévia
// editável e atalhos para cada tipo: evento, tarefa, lembrete, anotação e hábito.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { useFeedback } from '@/components/Feedback';
import { Icon, type IconName } from '@/components/Icon';
import { EnterItem } from '@/components/motion';
import { ParsePreview } from '@/components/QuickAddBar';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useLayout } from '@/hooks/useLayout';
import { t } from '@/i18n';
import { goBack } from '@/services/navigation';
import { defaultEventCalendar, saveQuick } from '@/services/quickCreate';
import { useAuthStore } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { todayKey } from '@/utils/dates';
import { needsReview, parseQuickAdd, type QuickKind } from '@/utils/quickAdd';

interface Option {
  key: 'event' | 'task' | 'reminder' | 'note' | 'habit';
  icon: IconName;
  title: string;
  hint: string;
}

const KINDS: QuickKind[] = ['task', 'reminder', 'event'];

export default function CreateScreen() {
  const params = useLocalSearchParams<{
    text?: string;
    listId?: string;
    calendarId?: string;
    date?: string;
  }>();
  const { colors } = useAppTheme();
  const { size } = useLayout();
  const { toast } = useFeedback();
  const display = useDisplaySettings();
  const calendars = useDataStore((s) => s.calendars);
  const online = useSyncStore((s) => s.online);
  const defaultReminder = useAuthStore(
    (s) => s.account?.notification_preferences.default_reminder_minutes ?? null,
  );
  const today = todayKey(display.timezone);
  const [text, setText] = useState(params.text ?? '');
  const [kind, setKind] = useState<QuickKind | null>(null);
  const [saving, setSaving] = useState(false);
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, today) : null), [text, today]);
  const parse = parsed && kind ? { ...parsed, kind } : parsed;
  const hasCalendar = !!defaultEventCalendar(calendars);

  const options: Option[] = [
    { key: 'event', icon: 'calendar-outline', title: t('create.event'), hint: t('create.eventHint') },
    { key: 'task', icon: 'task-outline', title: t('create.task'), hint: t('create.taskHint') },
    {
      key: 'reminder',
      icon: 'notifications-outline',
      title: t('create.reminder'),
      hint: t('create.reminderHint'),
    },
    { key: 'note', icon: 'document-text-outline', title: t('create.note'), hint: t('create.noteHint') },
    { key: 'habit', icon: 'leaf-outline', title: t('create.habit'), hint: t('create.habitHint') },
  ];

  const open = (key: Option['key']) => {
    const title = parse?.title ?? '';
    const day = parse?.date ?? params.date ?? '';
    switch (key) {
      case 'event':
        return router.replace({
          pathname: '/event/new',
          params: {
            date: day || today,
            title,
            start: parse?.time ?? '',
            end: parse?.endTime ?? '',
            calendarId: params.calendarId ?? '',
          },
        });
      case 'task':
      case 'reminder':
        return router.replace({
          pathname: '/task/new',
          params: {
            type: key,
            title,
            date: day,
            listId: params.listId ?? '',
            calendarId: params.calendarId ?? '',
          },
        });
      case 'note':
        return router.replace({ pathname: '/notes/new', params: { calendarId: params.calendarId ?? '' } });
      case 'habit':
        return router.replace('/habits/new');
    }
  };

  const save = async () => {
    if (!parse || !parse.title) return;
    setSaving(true);
    try {
      const saved = await saveQuick(parse, calendars, {
        timezone: display.timezone,
        listId: params.listId || null,
        calendarId: params.calendarId || null,
        defaultReminder,
      });
      if (!saved) {
        toast(t('create.noCalendar'), 'error');
        return;
      }
      const message =
        saved.kind === 'event'
          ? t('events.created')
          : saved.kind === 'reminder'
            ? t('tasks.reminderCreated')
            : t('tasks.created');
      toast(online ? message : t('events.savedOffline'));
      goBack();
    } finally {
      setSaving(false);
    }
  };

  const review = parse ? needsReview(parse) : false;
  const columns = size === 'compact' ? 2 : 3;

  return (
    <Screen
      footer={
        parse ? (
          <View style={styles.footer}>
            <View style={styles.flex}>
              <Button title={t('create.openForm')} variant="secondary" onPress={() => open(parse.kind)} />
            </View>
            <View style={styles.flex}>
              <Button
                title={t('create.save')}
                onPress={() => void save()}
                loading={saving}
                disabled={!parse.title || (parse.kind === 'event' && !hasCalendar)}
                testID="create-save"
              />
            </View>
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: t('create.title') }} />
      <TextField
        label={t('create.quickLabel')}
        placeholder={t('create.quickPlaceholder')}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setKind(null);
        }}
        hint={t('create.quickHint')}
        autoFocus={!params.text}
        maxLength={300}
        onSubmitEditing={() => {
          if (!review) void save();
        }}
        returnKeyType="done"
        testID="create-text"
      />
      {parse && (
        <Card style={styles.gap}>
          <AppText variant="overline" tone="muted">
            {review ? t('create.reviewTitle') : t('create.preview')}
          </AppText>
          <AppText variant="heading">{parse.title || '...'}</AppText>
          <ParsePreview parse={parse} today={today} />
          {parse.ambiguities.map((a) => (
            <View key={a} style={styles.warn}>
              <Icon name="alert-circle-outline" size={16} color={colors.warning} />
              <AppText variant="small" tone="warning" style={styles.flex}>
                {a}
              </AppText>
            </View>
          ))}
          <AppText variant="label">{t('create.kindLabel')}</AppText>
          <View style={styles.chips}>
            {KINDS.map((k) => (
              <Chip key={k} label={t(`create.${k}`)} selected={parse.kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
          {parse.kind === 'event' && !hasCalendar && (
            <AppText variant="small" tone="danger">
              {t('create.noCalendar')}
            </AppText>
          )}
        </Card>
      )}
      <View style={styles.grid}>
        {options.map((o, i) => (
          <EnterItem key={o.key} index={i} style={{ width: `${100 / columns}%`, padding: spacing.xs }}>
            <Card
              onPress={() => open(o.key)}
              accessibilityLabel={`${o.title}. ${o.hint}`}
              style={styles.tile}
            >
              <View style={[styles.tileIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name={o.icon} size={24} color={colors.primaryInk} />
              </View>
              <AppText variant="heading">{o.title}</AppText>
              <AppText variant="caption" tone="muted">
                {o.hint}
              </AppText>
            </Card>
          </EnterItem>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  warn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  tile: { gap: spacing.xs, minHeight: 132 },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
