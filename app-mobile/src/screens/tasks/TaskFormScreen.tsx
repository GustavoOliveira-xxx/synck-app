// Criar e editar tarefas e lembretes. Uma tarefa simples só precisa do título;
// o resto fica em "Mais opções".
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DateTimeField } from '@/components/DateTimeField';
import { useFeedback } from '@/components/Feedback';
import { IconButton } from '@/components/IconButton';
import { RecurrenceEditor } from '@/components/RecurrenceEditor';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SelectField } from '@/components/SelectField';
import { EmptyState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useCalendarMembers } from '@/hooks/useCalendarMembers';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useLists, useTask } from '@/hooks/useItems';
import { strings, t } from '@/i18n';
import type { ItemType, RecurrenceMode, TaskPriority, TaskPrivacy, TaskStatus } from '@/models/types';
import { newId } from '@/offline/storage';
import { createTask, updateTask } from '@/services/itemActions';
import { requestPermission } from '@/services/localNotifications';
import { goBack } from '@/services/navigation';
import { useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { spacing } from '@/theme/tokens';
import { instantToLocal, isValidDateKey, todayKey } from '@/utils/dates';
import { canCreateEvents } from '@/utils/permissions';
import { PRIORITIES, priorityMarks } from '@/utils/tasks';
import { timezoneOptions } from '@/utils/timezones';
import { newTaskForm, parseTags, taskToForm, validateTaskForm, type TaskForm } from '@/validation/task';

import { ReminderPicker } from '../events/ReminderPicker';

const ESTIMATES = [15, 30, 45, 60, 90, 120, 180, 240];
const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'waiting', 'done', 'cancelled'];
const PRIVACIES: TaskPrivacy[] = ['members', 'participants', 'private'];

export function estimateLabel(minutes: number | null): string {
  if (!minutes) return t('tasks.estimateNone');
  if (minutes < 60) return t('tasks.estimateMinutes', { n: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? t('tasks.estimateHoursMinutes', { h, m }) : t('tasks.estimateHours', { h });
}

/** Próxima hora cheia, no fuso de exibição (para lembretes novos). */
function nextHour(timezone: string): string {
  const local = instantToLocal(new Date(Date.now() + 60 * 60_000), timezone);
  return `${local.time.slice(0, 2)}:00`;
}

function Form({ initial, editing, taskId }: { initial: TaskForm; editing: boolean; taskId?: string }) {
  const display = useDisplaySettings();
  const userId = useUserId();
  const { toast } = useFeedback();
  const online = useSyncStore((s) => s.online);
  const calendars = useDataStore((s) => s.calendars);
  const task = useTask(taskId);
  const lists = useLists();
  const { plan } = useLocalSearchParams<{ plan?: string }>();
  const [form, setForm] = useState<TaskForm>(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validateTaskForm>>({});
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(editing);
  const [tagText, setTagText] = useState(initial.tags.join(', '));
  const [linkText, setLinkText] = useState(initial.links.join('\n'));
  const [step, setStep] = useState('');
  const set = <K extends keyof TaskForm>(key: K, value: TaskForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const people = useCalendarMembers(form.calendarId ?? undefined);
  const reminder = form.itemType === 'reminder';

  const writable = useMemo(() => calendars.filter((c) => canCreateEvents(c)), [calendars]);
  const listOptions = lists.filter((l) => l.calendar_id === form.calendarId);

  const save = async () => {
    const next = { ...form, tags: parseTags(tagText), links: linkText.split(/\s+/).filter(Boolean) };
    const v = validateTaskForm(next);
    setErrors(v);
    if (Object.keys(v).length) {
      toast(t('errors.invalidData'), 'error');
      return;
    }
    setSaving(true);
    try {
      if (next.alerts.length && next.dueDate) await requestPermission().catch(() => false);
      if (editing && task) await updateTask(task, next);
      else await createTask(next, { planDay: plan && isValidDateKey(plan) ? plan : null });
      toast(
        !online
          ? t('events.savedOffline')
          : editing
            ? t('tasks.updated')
            : reminder
              ? t('tasks.reminderCreated')
              : t('tasks.created'),
      );
      goBack();
    } catch {
      toast(t('errors.generic'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const dueBlock = form.dueDate ? (
    <View style={styles.gap}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <DateTimeField
            mode="date"
            label={reminder ? t('tasks.reminderDate') : t('tasks.dueDate')}
            value={form.dueDate}
            onChange={(v) => set('dueDate', v)}
            dateFormat={display.dateFormat}
            error={errors.due}
          />
        </View>
        {form.dueTime ? (
          <View style={styles.flex}>
            <DateTimeField
              mode="time"
              label={reminder ? t('tasks.reminderTime') : t('tasks.dueTime')}
              value={form.dueTime}
              onChange={(v) => set('dueTime', v)}
              timeFormat={display.timeFormat}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.inline}>
        {form.dueTime ? (
          <Button
            title={t('tasks.removeTime')}
            variant="ghost"
            compact
            icon="close"
            onPress={() => set('dueTime', null)}
          />
        ) : (
          <Button
            title={t('tasks.addTime')}
            variant="ghost"
            compact
            icon="time-outline"
            onPress={() => set('dueTime', nextHour(form.timezone))}
          />
        )}
        <Button
          title={t('tasks.removeDue')}
          variant="ghost"
          compact
          icon="close"
          onPress={() => setForm((f) => ({ ...f, dueDate: null, dueTime: null, recurrence: null }))}
        />
      </View>
    </View>
  ) : (
    <Button
      title={t('tasks.addDue')}
      variant="secondary"
      icon="calendar-outline"
      onPress={() =>
        setForm((f) => ({
          ...f,
          dueDate: todayKey(display.timezone),
          dueTime: reminder ? nextHour(f.timezone) : f.dueTime,
        }))
      }
    />
  );

  return (
    <Screen footer={<Button title={t('common.save')} onPress={save} loading={saving} testID="task-save" />}>
      {!editing && (
        <SegmentedControl<ItemType>
          label={t('create.kindLabel')}
          value={form.itemType}
          onChange={(v) =>
            setForm((f) => ({
              ...f,
              itemType: v,
              alerts: v === 'reminder' && f.alerts.length === 0 ? [0] : f.alerts,
            }))
          }
          options={[
            { value: 'task', label: t('create.task') },
            { value: 'reminder', label: t('create.reminder') },
          ]}
        />
      )}
      <TextField
        label={t('tasks.titleLabel')}
        placeholder={reminder ? t('tasks.reminderPlaceholder') : t('tasks.titlePlaceholder')}
        value={form.title}
        onChangeText={(v) => set('title', v)}
        error={errors.title}
        maxLength={200}
        autoFocus={!editing}
        testID="task-title"
      />
      <AppText variant="label">{reminder ? t('tasks.reminderDate') : t('tasks.due')}</AppText>
      {dueBlock}

      {!reminder && (
        <View style={styles.gap}>
          <AppText variant="label">{t('tasks.priority')}</AppText>
          <View style={styles.chips}>
            {PRIORITIES.slice()
              .reverse()
              .map((p: TaskPriority) => (
                <Chip
                  key={p}
                  label={`${strings.tasks.priorities[p]}${priorityMarks(p) ? ` ${priorityMarks(p)}` : ''}`}
                  accessibilityLabel={strings.tasks.priorities[p]}
                  selected={form.priority === p}
                  onPress={() => set('priority', p)}
                />
              ))}
          </View>
        </View>
      )}

      {form.dueDate && (
        <View style={styles.gap}>
          <RecurrenceEditor
            rule={form.recurrence}
            startDate={form.dueDate}
            onChange={(r) => set('recurrence', r)}
            error={errors.recurrence}
            simple={form.recurrenceMode === 'completion'}
          />
          {form.recurrence && !reminder && (
            <SelectField<RecurrenceMode>
              label={t('tasks.repeatMode')}
              value={form.recurrenceMode}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  recurrenceMode: v,
                  recurrence:
                    v === 'completion' && f.recurrence
                      ? { ...f.recurrence, byDay: [], byMonthDay: null, until: null, count: null }
                      : f.recurrence,
                }))
              }
              options={[
                { value: 'calendar', label: t('tasks.repeatCalendar') },
                {
                  value: 'completion',
                  label: t('tasks.repeatCompletion'),
                  description: t('tasks.repeatCompletionHint'),
                },
              ]}
            />
          )}
        </View>
      )}

      {form.dueDate ? (
        <ReminderPicker
          value={form.alerts}
          onChange={(v) => set('alerts', v)}
          error={errors.alerts}
          label={t('tasks.alerts')}
          hint={t('tasks.alertsHint')}
        />
      ) : (
        <AppText variant="small" tone="muted">
          {t('tasks.alertsNeedDate')}
        </AppText>
      )}

      <SelectField<string | null>
        label={t('tasks.calendar')}
        value={form.calendarId}
        onChange={(v) =>
          setForm((f) => ({ ...f, calendarId: v, listId: null, assigneeId: null, participantIds: [] }))
        }
        options={[
          { value: null, label: t('tasks.personal') },
          ...writable
            .filter((c) => c.kind !== 'personal')
            .map((c) => ({
              value: c.id as string | null,
              label: c.name,
              description: strings.calendarKinds[c.kind],
            })),
        ]}
      />
      <SelectField<string | null>
        label={t('tasks.list')}
        value={form.listId}
        onChange={(v) => set('listId', v)}
        options={[
          { value: null, label: t('tasks.noList') },
          ...listOptions.map((l) => ({ value: l.id as string | null, label: l.name })),
        ]}
      />

      {!editing && !reminder && (
        <View style={styles.gap}>
          <SectionHeader title={t('tasks.checklist')} />
          {form.checklist.map((c, i) => (
            <View key={c.id} style={styles.stepRow}>
              <AppText style={styles.flex}>{`${i + 1}. ${c.title}`}</AppText>
              <IconButton
                icon="close"
                label={t('tasks.removeStep')}
                onPress={() =>
                  set(
                    'checklist',
                    form.checklist.filter((x) => x.id !== c.id),
                  )
                }
              />
            </View>
          ))}
          <View style={styles.stepRow}>
            <View style={styles.flex}>
              <TextField
                label={t('tasks.checklistAdd')}
                placeholder={t('tasks.checklistPlaceholder')}
                value={step}
                onChangeText={setStep}
                maxLength={200}
                onSubmitEditing={() => {
                  if (!step.trim()) return;
                  set('checklist', [...form.checklist, { id: newId(), title: step.trim(), done: false }]);
                  setStep('');
                }}
                returnKeyType="done"
              />
            </View>
            <IconButton
              icon="add"
              label={t('tasks.checklistAdd')}
              disabled={!step.trim()}
              onPress={() => {
                set('checklist', [...form.checklist, { id: newId(), title: step.trim(), done: false }]);
                setStep('');
              }}
            />
          </View>
        </View>
      )}

      <Button
        title={showMore ? t('events.lessOptions') : t('events.moreOptions')}
        icon={showMore ? 'chevron-up' : 'chevron-down'}
        variant="ghost"
        onPress={() => setShowMore((s) => !s)}
      />
      {showMore && (
        <>
          <TextField
            label={`${t('tasks.description')} (${t('common.optional')})`}
            value={form.description}
            onChangeText={(v) => set('description', v)}
            error={errors.description}
            multiline
            maxLength={5000}
          />
          {!reminder && (
            <>
              <SelectField<number | null>
                label={t('tasks.estimate')}
                value={form.estimatedMinutes}
                onChange={(v) => set('estimatedMinutes', v)}
                options={[null, ...ESTIMATES].map((m) => ({ value: m, label: estimateLabel(m) }))}
              />
              {form.dueDate &&
                (form.startDate ? (
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <DateTimeField
                        mode="date"
                        label={t('tasks.startDate')}
                        value={form.startDate}
                        onChange={(v) => set('startDate', v)}
                        dateFormat={display.dateFormat}
                        error={errors.start}
                      />
                    </View>
                    <IconButton
                      icon="close"
                      label={t('common.clear')}
                      onPress={() => set('startDate', null)}
                    />
                  </View>
                ) : (
                  <Button
                    title={t('tasks.startDate')}
                    variant="ghost"
                    icon="calendar-outline"
                    onPress={() => set('startDate', todayKey(display.timezone))}
                  />
                ))}
              <SelectField<TaskStatus>
                label={t('tasks.status')}
                value={form.status}
                onChange={(v) => set('status', v)}
                options={STATUSES.map((s) => ({ value: s, label: strings.tasks.statuses[s] }))}
              />
            </>
          )}
          <TextField
            label={t('tasks.tags')}
            placeholder={t('tasks.tagsPlaceholder')}
            value={tagText}
            onChangeText={setTagText}
            error={errors.tags}
            autoCapitalize="none"
          />
          <TextField
            label={t('tasks.links')}
            placeholder={t('events.linkPlaceholder')}
            value={linkText}
            onChangeText={setLinkText}
            error={errors.links}
            autoCapitalize="none"
            keyboardType="url"
            multiline
          />
          {form.calendarId && people.length > 0 && (
            <>
              <SelectField<string | null>
                label={t('tasks.assignee')}
                value={form.assigneeId}
                onChange={(v) => set('assigneeId', v)}
                options={[
                  { value: null, label: t('tasks.noAssignee') },
                  ...people.map((p) => ({
                    value: p.user_id as string | null,
                    label: p.is_me ? t('common.you') : p.display_name,
                  })),
                ]}
              />
              <SectionHeader title={t('tasks.participants')} />
              <AppText variant="small" tone="muted">
                {t('tasks.participantsHint')}
              </AppText>
              <View style={styles.chips}>
                {people.map((p) => {
                  const selected = form.participantIds.includes(p.user_id);
                  return (
                    <Chip
                      key={p.user_id}
                      label={p.user_id === userId ? t('common.you') : p.display_name}
                      selected={selected}
                      onPress={() =>
                        set(
                          'participantIds',
                          selected
                            ? form.participantIds.filter((x) => x !== p.user_id)
                            : [...form.participantIds, p.user_id],
                        )
                      }
                    />
                  );
                })}
              </View>
              <SelectField<TaskPrivacy>
                label={t('tasks.privacy')}
                value={form.privacy}
                onChange={(v) => set('privacy', v)}
                options={PRIVACIES.map((v) => ({
                  value: v,
                  label: strings.tasks.privacyOptions[v],
                  disabled:
                    v === 'private' && !calendars.find((c) => c.id === form.calendarId)?.allow_private_events,
                }))}
              />
            </>
          )}
          <SelectField<string>
            label={t('events.timezone')}
            value={form.timezone}
            onChange={(v) => set('timezone', v)}
            options={timezoneOptions(display.timezone)}
            searchable
            searchPlaceholder={t('preferences.searchTimezone')}
          />
        </>
      )}
    </Screen>
  );
}

/** Rotas /task/new (?type=reminder&date=&listId=&calendarId=&title=&plan=) e /task/[id]/edit. */
export default function TaskFormScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    type?: string;
    date?: string;
    listId?: string;
    calendarId?: string;
    title?: string;
  }>();
  const display = useDisplaySettings();
  const task = useTask(params.id);
  const lists = useLists();

  if (params.id && !task) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('tasks.notFound')} />
      </Screen>
    );
  }

  let initial: TaskForm;
  if (task) {
    initial = taskToForm(task);
  } else {
    const type: ItemType = params.type === 'reminder' ? 'reminder' : 'task';
    const list = lists.find((l) => l.id === params.listId);
    const date = params.date && isValidDateKey(params.date) ? params.date : null;
    initial = newTaskForm(type, display.timezone, {
      title: params.title ?? '',
      listId: list?.id ?? null,
      calendarId: list ? list.calendar_id : params.calendarId || null,
      dueDate: date ?? (type === 'reminder' ? todayKey(display.timezone) : null),
      dueTime: type === 'reminder' ? nextHour(display.timezone) : null,
      alerts: type === 'reminder' ? [0] : [],
    });
  }

  const title = task
    ? task.item_type === 'reminder'
      ? t('tasks.editReminder')
      : t('tasks.edit')
    : params.type === 'reminder'
      ? t('tasks.newReminder')
      : t('tasks.new');

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Form initial={initial} editing={!!task} taskId={task?.id} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
  inline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
});
