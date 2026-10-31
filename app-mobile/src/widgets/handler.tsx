// O que cada widget desenha. Roda no app aberto (ao atualizar) e também em
// segundo plano, chamado pelo Android (ao adicionar, redimensionar e a cada
// 30 minutos), por isso só lê o retrato guardado no aparelho.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetInfo, WidgetRepresentation, WidgetTaskHandler } from 'react-native-android-widget';

import {
  EMPTY_SNAPSHOT,
  localToday,
  WIDGET_COUNTDOWN_KEY,
  WIDGET_SNAPSHOT_KEY,
  type WidgetCountdown,
  type WidgetSnapshot,
} from './snapshot';
import { CalendarioWidget, ContagemWidget, MeuDiaWidget } from './SynckWidgets';

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function renderSynckWidget(info: WidgetInfo): Promise<WidgetRepresentation> {
  const today = localToday();
  if (info.widgetName === 'SynckContagem') {
    const countdown = await read<WidgetCountdown | null>(WIDGET_COUNTDOWN_KEY, null);
    return {
      light: <ContagemWidget countdown={countdown} today={today} dark={false} width={info.width} />,
      dark: <ContagemWidget countdown={countdown} today={today} dark width={info.width} />,
    };
  }
  const snapshot = await read<WidgetSnapshot>(WIDGET_SNAPSHOT_KEY, EMPTY_SNAPSHOT);
  if (info.widgetName === 'SynckCalendario') {
    return {
      light: (
        <CalendarioWidget
          snapshot={snapshot}
          today={today}
          width={info.width}
          height={info.height}
          dark={false}
        />
      ),
      dark: (
        <CalendarioWidget snapshot={snapshot} today={today} width={info.width} height={info.height} dark />
      ),
    };
  }
  return {
    light: <MeuDiaWidget snapshot={snapshot} today={today} height={info.height} dark={false} />,
    dark: <MeuDiaWidget snapshot={snapshot} today={today} height={info.height} dark />,
  };
}

export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetInfo, widgetAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(await renderSynckWidget(widgetInfo));
};
