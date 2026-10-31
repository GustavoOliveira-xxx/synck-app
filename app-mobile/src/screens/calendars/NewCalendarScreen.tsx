import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAction } from '@/hooks/useAction';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { getDeviceTimezone } from '@/hooks/useDeviceTimezone';
import { t } from '@/i18n';
import type { CalendarKind } from '@/models/types';
import { syncNow } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { CALENDAR_COLORS } from '@/theme/tokens';
import { hasErrors } from '@/validation/auth';
import { validateCalendar } from '@/validation/calendar';

import { CalendarFormFields, type CalendarFormValues } from './CalendarFormFields';

export default function NewCalendarScreen() {
  const { run, busy } = useAction();
  const { kind } = useLocalSearchParams<{ kind?: CalendarKind }>();
  const [values, setValues] = useState<CalendarFormValues>({
    name: '',
    description: '',
    color: CALENDAR_COLORS[0].value,
    kind: kind === 'personal' ? 'personal' : 'shared',
    default_timezone: getDeviceTimezone(),
  });
  const { allowLeave } = useUnsavedChanges((!!values.name.trim() || !!values.description.trim()) && !busy);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'description' | 'color', string>>>({});

  const submit = async () => {
    const v = validateCalendar(values);
    setErrors(v);
    if (hasErrors(v)) return;
    const result = await run(
      () =>
        api.createCalendar({
          ...values,
          name: values.name.trim(),
          description: values.description.trim() || null,
        }),
      { success: t('calendars.created') },
    );
    if (result.ok) {
      await syncNow();
      allowLeave();
      router.replace({ pathname: '/calendar/[id]', params: { id: result.value } });
    }
  };

  return (
    <Screen footer={<Button title={t('calendars.create')} onPress={submit} loading={busy} />}>
      <Stack.Screen options={{ title: t('calendars.new') }} />
      <CalendarFormFields values={values} onChange={setValues} errors={errors} />
    </Screen>
  );
}
