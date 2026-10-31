// Android: grava o retrato da agenda e pede para os widgets se redesenharem.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { renderSynckWidget } from './handler';
import {
  WIDGET_COUNTDOWN_KEY,
  WIDGET_SNAPSHOT_KEY,
  WIDGETS,
  type WidgetCountdown,
  type WidgetSnapshot,
} from './snapshot';

export const widgetsSupported = true;

function redraw(): void {
  for (const widgetName of WIDGETS) {
    void requestWidgetUpdate({ widgetName, renderWidget: renderSynckWidget }).catch(() => undefined);
  }
}

export async function saveWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => undefined);
  redraw();
}

export async function saveWidgetCountdown(countdown: WidgetCountdown | null): Promise<void> {
  if (countdown)
    await AsyncStorage.setItem(WIDGET_COUNTDOWN_KEY, JSON.stringify(countdown)).catch(() => undefined);
  else await AsyncStorage.removeItem(WIDGET_COUNTDOWN_KEY).catch(() => undefined);
  redraw();
}

export async function readWidgetCountdown(): Promise<WidgetCountdown | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_COUNTDOWN_KEY);
    return raw ? (JSON.parse(raw) as WidgetCountdown) : null;
  } catch {
    return null;
  }
}

/** Saiu da conta: os widgets voltam a ficar vazios (nada da agenda fica na tela inicial). */
export async function clearWidgets(): Promise<void> {
  await AsyncStorage.multiRemove([WIDGET_SNAPSHOT_KEY, WIDGET_COUNTDOWN_KEY]).catch(() => undefined);
  redraw();
}
