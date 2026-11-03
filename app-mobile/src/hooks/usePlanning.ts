import { useEffect, useMemo, useState } from 'react';

import type { DateKey, Occurrence } from '@/models/types';
import { useNow } from './useNow';
import { routineBusy } from '@/utils/routine';
import { useAuthStore, useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { ensureRange } from '@/offline/syncEngine';
import { useSyncStore } from '@/stores/syncStore';
import { addDaysToKey, startOfDayInstant } from '@/utils/dates';
import { busyFromOccurrences, freeSlots, type FreeSlot, type Interval } from '@/utils/freeTime';

import { useDisplaySettings } from './useDisplaySettings';
import { useOccurrences } from './useEventsView';

/** O que ocupa a agenda da pessoa: eventos visíveis, sem os "Ocupado" de outros. */
export function myBusy(occurrences: Occurrence[], userId: string | null): Interval[] {
  return busyFromOccurrences(
    occurrences.filter(
      (o) =>
        !o.event.is_masked &&
        (o.event.attendee_ids.length === 0 || (!!userId && o.event.attendee_ids.includes(userId))),
    ),
  );
}

/** Horários livres nos dias pedidos (janela do dia da pessoa). */
export function useFreeSlots(
  days: DateKey[],
  minMinutes = 30,
  excludeEventId?: string,
  timezone?: string,
): { slots: FreeSlot[]; occurrences: Occurrence[]; loading: boolean; complete: boolean } {
  const settings = useDisplaySettings();
  const display = { ...settings, timezone: timezone ?? settings.timezone };
  const routines = useAuthStore((s) => s.account?.preferences.routine_periods);
  const now = useNow();
  const userId = useUserId();
  const first = days[0];
  const last = days[days.length - 1];
  const from = useMemo(() => startOfDayInstant(first, display.timezone), [first, display.timezone]);
  const to = useMemo(
    () => startOfDayInstant(addDaysToKey(last, 1), display.timezone),
    [last, display.timezone],
  );
  const window = useDataStore((s) => s.window);
  const online = useSyncStore((s) => s.online);
  const complete = !!window && new Date(window.from) <= from && new Date(window.to) >= to;
  const rangeKey = from.toISOString() + to.toISOString();
  const [attempted, setAttempted] = useState('');
  useEffect(() => {
    if (complete || !online || !window || attempted === rangeKey) return;
    let active = true;
    void ensureRange(from, to).finally(() => {
      if (active) setAttempted(rangeKey);
    });
    return () => {
      active = false;
    };
  }, [complete, online, window, from, to, attempted, rangeKey]);
  const loading = online && !!window && !complete && attempted !== rangeKey;
  const occurrences = useOccurrences(from, to);
  const key = days.join(',');
  const slots = useMemo(
    () =>
      freeSlots(
        [
          ...myBusy(
            occurrences.filter((o) => o.event.id !== excludeEventId),
            userId,
          ),
          ...routineBusy(routines ?? [], key.split(',')),
        ],
        key.split(','),
        display.timezone,
        display.dayStart,
        display.dayEnd,
        {
          minMinutes,
          now: new Date(now),
        },
      ),
    [
      occurrences,
      userId,
      key,
      display.timezone,
      display.dayStart,
      display.dayEnd,
      minMinutes,
      routines,
      excludeEventId,
      now,
    ],
  );
  return { slots, occurrences, loading, complete };
}
