import { useState } from 'react';
import { useCalendarsMap } from '@/hooks/useEventsView';
import { useUserId } from '@/stores/authStore';
import { canEditEvent } from '@/utils/permissions';
import { setOccurrenceCompleted, restoreOccurrenceCompletion } from '@/services/eventActions';
import type { Occurrence } from '@/models/types';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { useFeedback } from './Feedback';
export function EventCompletion({
  occurrence,
  compact = false,
}: {
  occurrence: Occurrence;
  compact?: boolean;
}) {
  const calendars = useCalendarsMap();
  const userId = useUserId();
  const [busy, setBusy] = useState(false);
  const { toast } = useFeedback();
  const event = occurrence.event,
    calendar = calendars[event.calendar_id];
  if (
    occurrence.routine ||
    !calendar ||
    event.is_masked ||
    !canEditEvent(calendar, event, userId) ||
    ['cancelled', 'archived'].includes(event.status)
  )
    return null;
  const done = event.status === 'completed';
  const action = async () => {
    setBusy(true);
    try {
      await setOccurrenceCompleted(occurrence, !done);
      toast(
        done
          ? 'Evento reaberto.'
          : occurrence.isRecurring
            ? 'Esta ocorrência foi concluída.'
            : 'Evento concluído.',
        'success',
        {
          label: 'Desfazer',
          onPress: () => {
            void restoreOccurrenceCompletion(occurrence).catch(() =>
              toast('Não foi possível desfazer.', 'error'),
            );
          },
        },
      );
    } catch {
      toast('Não foi possível alterar o evento.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const label = (done ? 'Reabrir ' : 'Concluir ') + (occurrence.isRecurring ? 'esta ocorrência' : 'evento');
  return compact ? (
    <IconButton
      icon={done ? 'checkmark-circle' : 'checkmark-circle-outline'}
      label={label + ': ' + occurrence.title}
      onPress={() => void action()}
      disabled={busy}
    />
  ) : (
    <Button
      title={label}
      icon={done ? 'refresh' : 'checkmark'}
      onPress={action}
      loading={busy}
      variant="tonal"
    />
  );
}
