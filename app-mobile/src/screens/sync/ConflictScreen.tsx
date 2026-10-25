import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { strings, t, tDynamic } from '@/i18n';
import type { EventPrivacy, EventStatus, EventType } from '@/models/types';
import { resolveConflict, type ConflictChoice } from '@/services/eventActions';
import { goBack } from '@/services/navigation';
import { useSyncStore } from '@/stores/syncStore';
import { spacing } from '@/theme/tokens';
import { formatDateTime } from '@/utils/dates';

/** Mostra a minha versão e a do servidor lado a lado para decidir o que manter. */
export default function ConflictScreen() {
  const { opId } = useLocalSearchParams<{ opId: string }>();
  const op = useSyncStore((s) => s.outbox.find((o) => o.id === opId));
  const display = useDisplaySettings();
  const { toast } = useFeedback();

  if (!op || !op.conflict) {
    return (
      <Screen>
        <EmptyState icon="checkmark-circle-outline" title={t('sync.queueEmpty')} />
      </Screen>
    );
  }

  const server = op.conflict.server;
  const title = (server.title as string | undefined) ?? (op.payload.title as string | undefined) ?? '';
  const fields = Object.keys(op.payload);

  const show = (key: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '-';
    if (key === 'starts_at' || key === 'ends_at') {
      return formatDateTime(
        new Date(value as string),
        display.timezone,
        display.dateFormat,
        display.timeFormat,
      );
    }
    if (key === 'status')
      return op.entity === 'task'
        ? (strings.tasks.statuses[value as keyof typeof strings.tasks.statuses] ?? String(value))
        : (strings.eventStatus[value as EventStatus] ?? String(value));
    if (key === 'priority') return strings.tasks.priorities[Number(value) as 0] ?? String(value);
    if (Array.isArray(value)) return value.join(', ') || '-';
    if (key === 'event_type') return strings.eventTypes[value as EventType] ?? String(value);
    if (key === 'privacy') return strings.privacy[value as EventPrivacy] ?? String(value);
    if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
    return String(value);
  };
  const label = (key: string) => {
    const map: Record<string, string> = {
      title: t('events.titleLabel'),
      starts_at: t('events.start'),
      ends_at: t('events.end'),
      location: t('events.location'),
      description: t('events.description'),
      status: t('events.status'),
      privacy: t('events.privacy'),
      event_type: t('events.type'),
      recurrence_rule: t('events.repeat'),
      all_day: t('events.allDay'),
      due: t('tasks.due'),
      due_date: t('tasks.dueDate'),
      due_time: t('tasks.dueTime'),
      priority: t('tasks.priority'),
      tags: t('tasks.tags'),
      list_id: t('tasks.list'),
      assignee_id: t('tasks.assignee'),
      body: t('notes.body'),
      name: t('tasks.listName'),
      estimated_minutes: t('tasks.estimate'),
    };
    return map[key] ?? tDynamic(`activity.changed.${key}`);
  };

  const choose = async (choice: ConflictChoice) => {
    await resolveConflict(op, choice);
    toast(t('sync.resolved'));
    goBack();
  };

  const deleted = op.conflict.reason === 'deleted';

  return (
    <Screen>
      <Stack.Screen options={{ title: t('sync.conflictTitle') }} />
      <AppText>
        {deleted ? t('sync.conflictDeletedMessage', { title }) : t('sync.conflictMessage', { title })}
      </AppText>
      {fields
        .filter((key) => !['calendar_id', 'start_date', 'end_date', 'timezone'].includes(key))
        .map((key) => (
          <Card key={key}>
            <AppText variant="label">{label(key)}</AppText>
            <View style={styles.compare}>
              <View style={styles.flex}>
                <AppText variant="caption" tone="muted">
                  {t('sync.yourVersion')}
                </AppText>
                <AppText>{show(key, op.payload[key])}</AppText>
              </View>
              {!deleted && (
                <View style={styles.flex}>
                  <AppText variant="caption" tone="muted">
                    {t('sync.serverVersion')}
                  </AppText>
                  <AppText>{show(key, server[key as keyof typeof server])}</AppText>
                </View>
              )}
            </View>
          </Card>
        ))}
      {deleted ? (
        <>
          <Button title={t('sync.recreate')} onPress={() => choose('recreate')} />
          <Button
            title={t('sync.acceptDeletion')}
            variant="secondary"
            onPress={() => choose('accept_delete')}
          />
        </>
      ) : (
        <>
          <Button title={t('sync.keepMine')} onPress={() => choose('mine')} />
          <Button title={t('sync.keepServer')} variant="secondary" onPress={() => choose('server')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  compare: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
