import { useEffect, useMemo } from 'react';

import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useItems } from '@/hooks/useItems';
import { useNow } from '@/hooks/useNow';
import { setAppBadge } from '@/services/appBadge';
import { useDataStore } from '@/stores/dataStore';
import { todayKey } from '@/utils/dates';
import { badgeCount } from '@/utils/tasks';

/**
 * Mantém o número no ícone do app igual ao da visão "Hoje" das tarefas:
 * atualiza ao concluir, criar ou sincronizar e na virada do dia. Com o app
 * fechado, quem atualiza é a notificação (o servidor manda o número junto).
 */
export function useAppBadge() {
  const items = useItems();
  const hydrated = useDataStore((s) => s.hydrated);
  const { timezone } = useDisplaySettings();
  const now = useNow();
  const today = todayKey(timezone, new Date(now));
  const count = useMemo(() => badgeCount(Object.values(items.tasks), today), [items.tasks, today]);
  useEffect(() => {
    if (hydrated) void setAppBadge(count);
  }, [count, hydrated]);
}
