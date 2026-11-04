import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { DateTimeField } from '@/components/DateTimeField';
import { useFeedback } from '@/components/Feedback';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useAuthStore } from '@/stores/authStore';
import { useEventsMap } from '@/hooks/useEventsView';
import { routineConflicts } from '@/utils/routine';
import { addDaysToKey, instantToLocal, localToInstant, formatShortDate, isValidDateKey } from '@/utils/dates';
import { expandEvents } from '@/utils/recurrence';
import { setRoutineException } from '@/services/routines';
import { goBack } from '@/services/navigation';

export default function RoutineDayScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date: string }>();
  const periods = useAuthStore((s) => s.account?.preferences.routine_periods) ?? [];
  const [expected] = useState(periods);
  const period = periods.find((p) => p.id === id);
  const exception = period?.exceptions?.find((e) => e.original_date === date);
  const display = useDisplaySettings();
  const events = useEventsMap();
  const { toast, confirm } = useFeedback();
  const [day, setDay] = useState(
    exception?.starts_at
      ? instantToLocal(new Date(exception.starts_at), period?.timezone ?? display.timezone).dateKey
      : date,
  );
  const [start, setStart] = useState(
    exception?.starts_at
      ? instantToLocal(new Date(exception.starts_at), period?.timezone ?? display.timezone).time.slice(0, 5)
      : (period?.start ?? '08:00'),
  );
  const [end, setEnd] = useState(
    exception?.ends_at
      ? instantToLocal(new Date(exception.ends_at), period?.timezone ?? display.timezone).time.slice(0, 5)
      : (period?.end ?? '09:00'),
  );
  const [initial] = useState({ day, start, end });
  const [busy, setBusy] = useState(false);
  const { allowLeave } = useUnsavedChanges(
    !busy && (day !== initial.day || start !== initial.start || end !== initial.end),
  );
  if (!period || !isValidDateKey(date))
    return (
      <Screen>
        <AppText>Este período não está mais disponível.</AppText>
      </Screen>
    );
  const save = async (action: 'skip' | 'move' | 'restore') => {
    if (action === 'move' && (!isValidDateKey(day) || start === end)) {
      toast('Confira a data e os horários.', 'error');
      return;
    }
    const a = localToInstant(
      action === 'restore' ? date : day,
      action === 'restore' ? period.start : start,
      period.timezone,
    );
    const finish = action === 'restore' ? period.end : end;
    const begin = action === 'restore' ? period.start : start;
    const base = action === 'restore' ? date : day;
    const b = localToInstant(finish < begin ? addDaysToKey(base, 1) : base, finish, period.timezone);
    if (action !== 'skip') {
      const others = periods.map((p) =>
        p.id === id
          ? {
              ...p,
              exceptions: [
                ...(p.exceptions ?? []).filter((e) => e.original_date !== date),
                { original_date: date, action: 'skip' as const },
              ],
            }
          : p,
      );
      const collisions = [
        ...routineConflicts(others, +a, +b).map((x) => x.period.title),
        ...expandEvents(Object.values(events), a, b)
          .filter(
            (x) =>
              !x.allDay && !['cancelled', 'archived'].includes(x.event.status) && x.start < b && x.end > a,
          )
          .map((x) => x.title ?? 'Ocupado'),
      ];
      if (
        collisions.length &&
        !(await confirm({
          title: 'Há outro compromisso neste horário',
          message: [...new Set(collisions)].join(', ') + '. Deseja manter a sobreposição?',
          confirmLabel: 'Manter os dois',
          cancelLabel: 'Escolher outro horário',
        }))
      )
        return;
    }
    if (
      action === 'skip' &&
      !(await confirm({
        title: 'Liberar só este dia?',
        message: period.title + ' em ' + formatShortDate(date) + '. Os próximos dias continuam iguais.',
        confirmLabel: 'Liberar este dia',
      }))
    )
      return;
    setBusy(true);
    try {
      await setRoutineException(
        id,
        date,
        action === 'restore'
          ? null
          : action === 'skip'
            ? { original_date: date, action }
            : { original_date: date, action, starts_at: a.toISOString(), ends_at: b.toISOString() },
        expected,
      );
      toast(
        action === 'skip'
          ? 'Horário liberado só neste dia.'
          : action === 'restore'
            ? 'Padrão restaurado neste dia.'
            : 'Ocorrência reagendada.',
      );
      allowLeave();
      goBack();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível salvar.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Rotina neste dia' }} />
      <AppText variant="heading">{period.title}</AppText>
      <AppText>
        {formatShortDate(date)} · {period.start}–{period.end}
      </AppText>
      <AppText tone="muted">
        {exception?.action === 'skip'
          ? 'Este dia foi liberado.'
          : exception?.action === 'move'
            ? 'Esta ocorrência foi reagendada.'
            : 'Período fixo da sua rotina.'}{' '}
        As alterações aqui valem somente para esta ocorrência, no fuso {period.timezone}.
      </AppText>
      <DateTimeField mode="date" label="Reagendar para" value={day} onChange={setDay} />
      <DateTimeField mode="time" label="Início" value={start} onChange={setStart} />
      <DateTimeField mode="time" label="Fim" value={end} onChange={setEnd} />
      {end < start && <AppText tone="muted">Termina no dia seguinte.</AppText>}
      <Button title="Reagendar só esta ocorrência" onPress={() => save('move')} loading={busy} />
      {exception?.action !== 'skip' && (
        <Button
          title="Não vou neste dia · liberar horário"
          variant="secondary"
          onPress={() => save('skip')}
          disabled={busy}
        />
      )}
      {exception && (
        <Button
          title="Restaurar padrão neste dia"
          variant="ghost"
          onPress={() => save('restore')}
          disabled={busy}
        />
      )}
      <AppText variant="small" tone="muted">
        As exceções exigem conexão para sincronizar com seus outros aparelhos. Nenhum evento é apagado ao
        liberar a rotina.
      </AppText>
    </Screen>
  );
}
