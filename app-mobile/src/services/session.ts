// Ciclo de vida da sessão: o que acontece ao entrar e ao sair da conta.
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { loadLocalState, requestSync, setAfterSyncHook, syncNow } from '@/offline/syncEngine';
import { clearUserData, getInstallationId } from '@/offline/storage';
import { overlayItems } from '@/offline/itemOverlay';
import { overlayPending } from '@/offline/outbox';
import { useAuthStore } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { clearWidgets } from '@/widgets/update';
import { getDeviceTimezone } from '@/hooks/useDeviceTimezone';
import { todayKey } from '@/utils/dates';
import { expandEvents } from '@/utils/recurrence';

import * as api from './api';
import { signOutThisDevice } from './auth';
import { logError } from './errorLog';
import { cancelAllReminders, rescheduleReminders } from './localNotifications';
import { startRealtime, stopRealtime } from './realtime';
import { forgetWebPush } from './webPush';

let activeUser: string | null = null;

/** Reagenda os lembretes locais a partir do estado atual. */
export async function refreshReminders(): Promise<void> {
  const userId = useAuthStore.getState().session?.user.id ?? null;
  const account = useAuthStore.getState().account;
  const events = overlayPending(useDataStore.getState().events, useSyncStore.getState().outbox, userId);
  const now = new Date();
  const occurrences = expandEvents(Object.values(events), now, new Date(now.getTime() + 31 * 86_400_000));
  const tz =
    account?.preferences.use_device_timezone === false ? account.preferences.timezone : getDeviceTimezone();
  const data = useDataStore.getState();
  const items = overlayItems(
    { tasks: data.tasks, lists: data.lists, notes: data.notes, habits: data.habits, checkins: data.checkins },
    useSyncStore.getState().outbox,
    userId,
    todayKey(tz),
  );
  await rescheduleReminders(
    occurrences,
    account?.notification_preferences ?? null,
    tz,
    account?.preferences.time_format ?? '24h',
    Object.values(items.tasks),
  );
}

export async function startSession(userId: string): Promise<void> {
  if (activeUser === userId) return;
  activeUser = userId;
  await loadLocalState(userId);
  setAfterSyncHook(refreshReminders);
  startRealtime(userId);
  void registerThisDevice();
  void syncNow();
}

async function registerThisDevice(): Promise<void> {
  try {
    await api.registerDevice({
      installationId: await getInstallationId(),
      platform: Platform.OS,
      deviceName: Device.modelName ?? Device.deviceName ?? null,
      osVersion: Device.osVersion ?? null,
      appVersion: env.appVersion,
    });
  } catch (error) {
    await logError('dispositivo', error);
  }
}

/** Sair: para o tempo real, cancela lembretes e apaga os dados deste aparelho. */
let ending = false;

export async function endSession(): Promise<void> {
  // Pode ser chamado pelo botão "Sair" e, em seguida, pelo aviso de sessão
  // encerrada: a segunda chamada não precisa fazer nada.
  if (ending) return;
  ending = true;
  try {
    await doEndSession();
  } finally {
    ending = false;
  }
}

async function doEndSession(): Promise<void> {
  const userId = activeUser ?? useAuthStore.getState().session?.user.id ?? null;
  activeUser = null;
  setAfterSyncHook(null);
  stopRealtime();
  await cancelAllReminders();
  await forgetWebPush();
  if (userId) await clearUserData(userId);
  // Widgets da tela inicial (Android) voltam a ficar vazios.
  await clearWidgets();
  useDataStore.getState().reset();
  useSyncStore.getState().reset();
  useAuthStore.getState().setAccount(null);
  await signOutThisDevice();
}

export function onAppForeground(): void {
  if (activeUser) requestSync({ pull: true });
}
