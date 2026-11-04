// Ações rápidas de tarefas usadas em várias telas: concluir com "Desfazer",
// menu do toque longo (fazer hoje, adiar, prioridade, excluir).
import { router } from '@/services/router';
import { useCallback, useState, type ReactNode } from 'react';

import { useFeedback } from '@/components/Feedback';
import { OptionSheet } from '@/components/OptionSheet';
import { strings, t } from '@/i18n';
import type { Task } from '@/models/types';
import {
  completeTask,
  deleteTask,
  moveTask,
  patchTask,
  postponeTask,
  reopenTask,
  setTaskPlan,
} from '@/services/itemActions';
import { addDaysToKey, formatShortDate, todayKey, weekdayOfKey } from '@/utils/dates';
import { isOpen } from '@/utils/tasks';

import { useDisplaySettings } from './useDisplaySettings';

type MenuAction =
  | 'complete'
  | 'reopen'
  | 'plan'
  | 'unplan'
  | 'tomorrow'
  | 'nextWeek'
  | 'pick'
  | 'important'
  | 'normal'
  | 'up'
  | 'down'
  | 'delete';

export function useTaskActions(options: { ordered?: Task[] } = {}) {
  const { toast, confirm } = useFeedback();
  const { timezone } = useDisplaySettings();
  const [menuTask, setMenuTask] = useState<Task | null>(null);

  const toggle = useCallback(
    async (task: Task) => {
      if (!isOpen(task)) {
        await reopenTask(task, task.recurrence_rule ? task.due_date : null);
        toast(t('tasks.reopened'));
        return;
      }
      const occurrence = task.recurrence_rule ? task.due_date : null;
      await completeTask(task, occurrence);
      toast(t('tasks.completed'), 'success', {
        label: t('tasks.undo'),
        onPress: () => void reopenTask(task, occurrence),
      });
    },
    [toast],
  );

  const today = todayKey(timezone);
  const run = async (task: Task, action: MenuAction) => {
    setMenuTask(null);
    switch (action) {
      case 'complete':
      case 'reopen':
        return toggle(task);
      case 'plan':
        await setTaskPlan(task, today);
        return toast(t('tasks.planned'));
      case 'unplan':
        return setTaskPlan(task, null);
      case 'tomorrow': {
        const day = addDaysToKey(today, 1);
        await postponeTask(task, day);
        return toast(t('tasks.postponed', { date: formatShortDate(day) }));
      }
      case 'nextWeek': {
        // Próxima segunda-feira.
        const day = addDaysToKey(today, (8 - weekdayOfKey(today)) % 7 || 7);
        await postponeTask(task, day);
        return toast(t('tasks.postponed', { date: formatShortDate(day) }));
      }
      case 'pick':
        return router.push({ pathname: '/task/[id]/edit', params: { id: task.id } });
      case 'important':
        return patchTask(task, { priority: 3 });
      case 'normal':
        return patchTask(task, { priority: 0 });
      case 'up':
      case 'down':
        return options.ordered ? moveTask(task, options.ordered, action === 'up' ? -1 : 1) : undefined;
      case 'delete': {
        const ok = await confirm({
          title: task.item_type === 'reminder' ? t('tasks.deleteReminderTitle') : t('tasks.deleteTitle'),
          message: t('tasks.deleteMessage'),
          destructive: true,
          confirmLabel: t('common.delete'),
        });
        if (ok) {
          await deleteTask(task);
          toast(t('tasks.deleted'));
        }
        return undefined;
      }
    }
  };

  const menuOptions = (task: Task) => {
    const open = isOpen(task);
    const list: { value: MenuAction; label: string }[] = [
      { value: open ? 'complete' : 'reopen', label: open ? t('tasks.complete') : t('tasks.reopen') },
    ];
    if (open) {
      list.push(
        task.plan_day === today
          ? { value: 'unplan', label: t('tasks.planRemove') }
          : { value: 'plan', label: t('tasks.planToday') },
        { value: 'tomorrow', label: `${t('tasks.postpone')}: ${t('tasks.postponeTomorrow')}` },
        { value: 'nextWeek', label: `${t('tasks.postpone')}: ${t('tasks.postponeNextWeek')}` },
        { value: 'pick', label: t('tasks.postponePick') },
        task.priority >= 3
          ? { value: 'normal', label: `${t('tasks.priority')}: ${strings.tasks.priorities[0]}` }
          : { value: 'important', label: `${t('tasks.priority')}: ${strings.tasks.priorities[3]}` },
      );
    }
    if (options.ordered) {
      list.push({ value: 'up', label: t('tasks.moveUp') }, { value: 'down', label: t('tasks.moveDown') });
    }
    list.push({ value: 'delete', label: t('common.delete') });
    return list;
  };

  const sheet: ReactNode = menuTask ? (
    <OptionSheet<MenuAction | null>
      visible
      title={menuTask.title}
      options={menuOptions(menuTask)}
      value={null}
      onSelect={(v) => v && void run(menuTask, v)}
      onClose={() => setMenuTask(null)}
    />
  ) : null;

  return { toggle, openMenu: setMenuTask, sheet };
}
