// Fora do Android não há widgets: estas funções não fazem nada.
import type { WidgetCountdown, WidgetSnapshot } from './snapshot';

export const widgetsSupported = false;

export async function saveWidgetSnapshot(_snapshot: WidgetSnapshot): Promise<void> {}

export async function saveWidgetCountdown(_countdown: WidgetCountdown | null): Promise<void> {}

export async function readWidgetCountdown(): Promise<WidgetCountdown | null> {
  return null;
}

export async function clearWidgets(): Promise<void> {}
