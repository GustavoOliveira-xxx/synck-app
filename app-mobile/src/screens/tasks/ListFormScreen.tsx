// Criar ou renomear uma lista de tarefas (pessoal ou de uma agenda).
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { ColorPicker } from '@/components/ColorPicker';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { EmptyState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useLists } from '@/hooks/useItems';
import { strings, t } from '@/i18n';
import { createList, updateList } from '@/services/itemActions';
import { goBack } from '@/services/navigation';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import { canCreateEvents } from '@/utils/permissions';

export default function ListFormScreen() {
  const { id, calendarId } = useLocalSearchParams<{ id?: string; calendarId?: string }>();
  const lists = useLists();
  const existing = id ? lists.find((l) => l.id === id) : undefined;
  const calendars = useDataStore((s) => s.calendars).filter(
    (c) => canCreateEvents(c) && c.kind !== 'personal',
  );
  const setView = useUiStore((s) => s.setTaskView);
  const { toast } = useFeedback();
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState<string | null>(existing?.color ?? null);
  const [calendar, setCalendar] = useState<string | null>(existing?.calendar_id ?? calendarId ?? null);
  const [error, setError] = useState<string>();

  if (id && !existing) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('errors.notFound')} />
      </Screen>
    );
  }

  const save = async () => {
    if (!name.trim()) {
      setError(t('validation.required'));
      return;
    }
    if (existing) {
      await updateList(existing, { name: name.trim(), color });
      toast(t('common.saved'));
    } else {
      const newId = await createList({ name, calendar_id: calendar, color });
      setView(`list:${newId}`);
      toast(t('tasks.listCreated'));
    }
    goBack();
  };

  return (
    <Screen footer={<Button title={t('common.save')} onPress={() => void save()} />}>
      <Stack.Screen options={{ title: existing ? t('tasks.listRename') : t('tasks.newList') }} />
      <TextField
        label={t('tasks.listName')}
        placeholder={t('tasks.listNamePlaceholder')}
        value={name}
        onChangeText={setName}
        error={error}
        maxLength={60}
        autoFocus
      />
      {!existing && (
        <SelectField<string | null>
          label={t('tasks.listCalendar')}
          value={calendar}
          onChange={setCalendar}
          options={[
            { value: null, label: t('tasks.personal') },
            ...calendars.map((c) => ({
              value: c.id as string | null,
              label: c.name,
              description: strings.calendarKinds[c.kind],
            })),
          ]}
        />
      )}
      <ColorPicker
        label={t('calendars.color')}
        value={color}
        onChange={setColor}
        allowNone
        noneLabel={t('events.useCalendarColor')}
      />
    </Screen>
  );
}
