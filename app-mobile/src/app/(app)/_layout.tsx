import * as Notifications from 'expo-notifications';
import { router, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';

import { useFeedback } from '@/components/Feedback';
import { completeTask } from '@/services/itemActions';
import { ACTION_DONE, ACTION_SNOOZE, forgetSnoozesFor, snoozeReminder } from '@/services/localNotifications';
import { parentRoute, pathFromRoute, setCurrentPath } from '@/services/navigation';
import { useDataStore } from '@/stores/dataStore';
import { IconButton } from '@/components/IconButton';
import { useAvailableUpdate } from '@/hooks/useAvailableUpdate';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte } from '@/theme/tokens';

/** Ao tocar num lembrete, abre o evento ou a tarefa; "Adiar 10 min" reagenda; "Concluir" conclui. */
function useOpenEventFromNotification() {
  const { toast } = useFeedback();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (data: Record<string, unknown> | undefined) => {
      if (data && typeof data.taskId === 'string') {
        router.push({ pathname: '/task/[id]', params: { id: data.taskId } });
        return;
      }
      if (data && typeof data.eventId === 'string') {
        router.push({
          pathname: '/event/[id]',
          params: { id: data.eventId, date: String(data.originalDate ?? '') },
        });
      }
    };
    const handle = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier === ACTION_SNOOZE) {
        void snoozeReminder(response.notification.request).then(() => toast(t('reminders.snoozed')));
        return;
      }
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (response.actionIdentifier === ACTION_DONE && data && typeof data.taskId === 'string') {
        const task = useDataStore.getState().tasks[data.taskId];
        void Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(
          () => undefined,
        );
        void forgetSnoozesFor(`task:${data.taskId}:`);
        if (task) {
          void completeTask(task, typeof data.occurrence === 'string' ? data.occurrence : null).then(() =>
            toast(t('tasks.completed'), 'success'),
          );
        } else {
          open(data);
        }
        return;
      }
      open(response.notification.request.content.data);
    };
    // Resposta que abriu o app (app estava fechado) e as próximas, com o app aberto.
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      handle(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [toast]);
}

/** No Android, avisa uma vez quando há um APK mais novo publicado. */
function useUpdateNotice() {
  const update = useAvailableUpdate();
  const { toast } = useFeedback();
  useEffect(() => {
    if (!update) return;
    toast(t('updates.available', { version: update.version }), 'info', {
      label: t('updates.download'),
      onPress: () => void Linking.openURL(update.url),
    });
  }, [update, toast]);
}

/**
 * Telas que sobem de baixo como uma folha (criar e editar): no topo, "Fechar"
 * (X) em vez da seta de voltar.
 */
const SHEETS = new Set([
  'event/new',
  'event/[id]/edit',
  'calendar/new',
  'create',
  'plan-day',
  'task/new',
  'task/[id]/edit',
  'task/[id]/block',
  'list/new',
  'list/[id]',
  'notes/new',
  'habits/new',
  'task-filters',
  'filters',
]);

export default function AppLayout() {
  const { colors, reduceMotion } = useAppTheme();
  const pathname = usePathname();
  useEffect(() => setCurrentPath(pathname), [pathname]);
  useOpenEventFromNotification();
  useUpdateNotice();
  return (
    <Stack
      screenOptions={({ navigation, route }) => {
        const isSheet = SHEETS.has(route.name);
        return {
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { ...fonte('titulo'), fontSize: 19 },
          headerTitleAlign: 'left',
          headerBackButtonDisplayMode: 'minimal',
          headerBackVisible: false,
          contentStyle: { backgroundColor: colors.background },
          animation: reduceMotion ? 'none' : isSheet ? 'slide_from_bottom' : 'slide_from_right',
          animationDuration: 280,
          gestureEnabled: true,
          // Sempre há para onde voltar: a tela anterior ou, se a tela foi aberta
          // direto por um link (ou depois de recarregar a página), a tela mãe.
          headerLeft: () => (
            <IconButton
              icon={isSheet ? 'close' : 'chevron-back'}
              label={isSheet ? t('common.close') : t('common.back')}
              onPress={() => {
                if (navigation.canGoBack()) navigation.goBack();
                else
                  router.replace(
                    parentRoute(pathFromRoute(route.name, route.params as Record<string, unknown>)),
                  );
              }}
            />
          ),
        };
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ title: t('notificationsInbox.title') }} />
      <Stack.Screen
        name="task-filters"
        options={{
          presentation: 'modal',
          title: t('tasks.filter'),
        }}
      />
      <Stack.Screen
        name="filters"
        options={{
          presentation: 'modal',
          title: t('filters.title'),
        }}
      />
    </Stack>
  );
}
