// Filtros da aba Tarefas (prazo, prioridade, andamento, tipo, responsável,
// agenda, lista, repetição e etiquetas). Uma tela só para todas as visões.
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { useLists, useTasks } from '@/hooks/useItems';
import { usePeople } from '@/hooks/usePeople';
import { strings, t } from '@/i18n';
import type { ItemType, TaskPriority, TaskStatus } from '@/models/types';
import { goBack } from '@/services/navigation';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import { spacing } from '@/theme/tokens';
import { DEFAULT_TASK_FILTERS, PRIORITIES, tagsInUse, type DueFilter } from '@/utils/tasks';

const DUE: DueFilter[] = ['any', 'overdue', 'today', 'week', 'nodate', 'withdate'];
const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'waiting', 'done', 'cancelled'];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="label" accessibilityRole="header">
        {title}
      </AppText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

export default function TaskFiltersScreen() {
  const filters = useUiStore((s) => s.taskFilters);
  const setFilters = useUiStore((s) => s.setTaskFilters);
  const tasks = useTasks();
  const lists = useLists();
  const people = usePeople();
  const calendars = useDataStore((s) => s.calendars).filter((c) => !c.deleted_at);
  const set = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) =>
    setFilters({ ...filters, [key]: value });
  const toggleIn = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  const tags = tagsInUse(tasks);
  const assignees = Object.entries(people).filter(([, p]) => !p.isMe);

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <View style={styles.flex}>
            <Button
              title={t('tasks.clearFilters')}
              variant="secondary"
              onPress={() => setFilters(DEFAULT_TASK_FILTERS)}
            />
          </View>
          <View style={styles.flex}>
            <Button title={t('common.apply')} onPress={() => goBack()} />
          </View>
        </View>
      }
    >
      <Stack.Screen options={{ title: t('tasks.filter') }} />
      <Group title={t('tasks.filterDue')}>
        {DUE.map((d) => (
          <Chip
            key={d}
            label={strings.tasks.filterDueOptions[d]}
            selected={filters.due === d}
            onPress={() => set('due', d)}
          />
        ))}
      </Group>
      <Group title={t('tasks.priority')}>
        {PRIORITIES.map((p: TaskPriority) => (
          <Chip
            key={p}
            label={strings.tasks.priorities[p]}
            selected={filters.priorities.includes(p)}
            onPress={() => set('priorities', toggleIn(filters.priorities, p))}
          />
        ))}
      </Group>
      <Group title={t('tasks.status')}>
        {STATUSES.map((s) => (
          <Chip
            key={s}
            label={strings.tasks.statuses[s]}
            selected={filters.statuses.includes(s)}
            onPress={() => set('statuses', toggleIn(filters.statuses, s))}
          />
        ))}
      </Group>
      <Group title={t('tasks.filterType')}>
        {([null, 'task', 'reminder'] as (ItemType | null)[]).map((v) => (
          <Chip
            key={v ?? 'all'}
            label={
              v === 'task'
                ? t('tasks.filterTypeTask')
                : v === 'reminder'
                  ? t('tasks.filterTypeReminder')
                  : t('search.all')
            }
            selected={filters.itemType === v}
            onPress={() => set('itemType', v)}
          />
        ))}
      </Group>
      <Group title={t('tasks.filterAssignee')}>
        <Chip
          label={t('tasks.filterAnyone')}
          selected={!filters.assignee}
          onPress={() => set('assignee', null)}
        />
        <Chip
          label={t('tasks.filterMe')}
          selected={filters.assignee === 'me'}
          onPress={() => set('assignee', 'me')}
        />
        <Chip
          label={t('tasks.filterUnassigned')}
          selected={filters.assignee === 'unassigned'}
          onPress={() => set('assignee', 'unassigned')}
        />
        {assignees.map(([id, p]) => (
          <Chip
            key={id}
            label={p.name}
            selected={filters.assignee === id}
            onPress={() => set('assignee', id)}
          />
        ))}
      </Group>
      <Group title={t('tasks.filterCalendar')}>
        <Chip
          label={t('tasks.filterAnyCalendar')}
          selected={!filters.calendarId}
          onPress={() => set('calendarId', null)}
        />
        <Chip
          label={t('tasks.personal')}
          selected={filters.calendarId === 'personal'}
          onPress={() => set('calendarId', 'personal')}
        />
        {calendars
          .filter((c) => c.kind !== 'personal')
          .map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={filters.calendarId === c.id}
              onPress={() => set('calendarId', c.id)}
            />
          ))}
      </Group>
      <SelectField<string | null>
        label={t('tasks.list')}
        value={filters.listId}
        onChange={(v) => set('listId', v)}
        options={[
          { value: null, label: t('tasks.filterAnyCalendar') },
          ...lists.map((l) => ({ value: l.id as string | null, label: l.name })),
        ]}
      />
      <Group title={t('tasks.filterRecurring')}>
        <Chip
          label={t('tasks.filterAnyone')}
          selected={filters.recurring === null}
          onPress={() => set('recurring', null)}
        />
        <Chip
          label={t('tasks.filterRecurringYes')}
          selected={filters.recurring === true}
          onPress={() => set('recurring', true)}
        />
        <Chip
          label={t('tasks.filterRecurringNo')}
          selected={filters.recurring === false}
          onPress={() => set('recurring', false)}
        />
      </Group>
      {tags.length > 0 && (
        <Group title={t('tasks.tags')}>
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={`#${tag}`}
              selected={filters.tags.includes(tag)}
              onPress={() => set('tags', toggleIn(filters.tags, tag))}
            />
          ))}
        </Group>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
