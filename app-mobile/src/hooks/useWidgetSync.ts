// Mantém os widgets da tela inicial (Android) em dia: sempre que a agenda
// muda, monta o retrato dos próximos dias e pede para eles se redesenharem.
// Espera um pouco entre mudanças seguidas (sincronização) para não redesenhar
// várias vezes. Fora do Android não faz nada.
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap, useOccurrences } from '@/hooks/useEventsView';
import { useTasks } from '@/hooks/useItems';
import { useDataStore } from '@/stores/dataStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { addDaysToKey, startOfDayInstant, todayKey } from '@/utils/dates';
import { buildSnapshot } from '@/widgets/snapshot';
import { saveWidgetSnapshot } from '@/widgets/update';

const ACTIVE = Platform.OS === 'android';

export function useWidgetSync(): void {
  const display = useDisplaySettings();
  const { colors } = useAppTheme();
  const hydrated = useDataStore((s) => s.hydrated);
  const today = todayKey(display.timezone);
  // Mês passado até dois meses à frente: cobre o mini calendário e os próximos dias.
  const [from, to] = useMemo(
    () => [
      startOfDayInstant(addDaysToKey(today, -40), display.timezone),
      startOfDayInstant(addDaysToKey(today, 70), display.timezone),
    ],
    [today, display.timezone],
  );
  const occurrences = useOccurrences(from, to);
  const tasks = useTasks();
  const calendars = useCalendarsMap();

  useEffect(() => {
    if (!ACTIVE || !hydrated) return;
    const timer = setTimeout(() => {
      const calendarColors = Object.fromEntries(Object.values(calendars).map((c) => [c.id, c.color]));
      void saveWidgetSnapshot(
        buildSnapshot({
          occurrences,
          tasks,
          calendarColors,
          timezone: display.timezone,
          weekStartsOn: display.weekStartsOn,
          today,
          fallbackColor: colors.primary,
        }),
      );
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    hydrated,
    occurrences,
    tasks,
    calendars,
    display.timezone,
    display.weekStartsOn,
    today,
    colors.primary,
  ]);
}
