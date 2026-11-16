// Fornece o tema (claro ou escuro, sempre o do aparelho) para todo o app e
// informa se o aparelho pede menos animações ou é modesto demais para as
// decorativas.
import * as Device from 'expo-device';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';

import { darkPalette, lightPalette, type Palette } from './tokens';

export interface AppTheme {
  colors: Palette;
  dark: boolean;
  reduceMotion: boolean;
  /**
   * Modo leve: "reduzir movimento" ligado ou aparelho modesto. Desliga os
   * laços decorativos (brilho, respiração, confete); toque, entradas e trocas
   * de tela continuam com mola.
   */
  lite: boolean;
}

const ThemeContext = createContext<AppTheme>({
  colors: lightPalette,
  dark: false,
  reduceMotion: false,
  lite: false,
});

/** Android com até 3 GB de memória ou de antes de 2017. */
export function isModestDevice(
  os: string = Platform.OS,
  memory: number | null = Device.totalMemory,
  yearClass: number | null = Device.deviceYearClass,
): boolean {
  if (os !== 'android') return false;
  if (memory != null && memory > 0 && memory <= 3.2e9) return true;
  return yearClass != null && yearClass > 0 && yearClass < 2017;
}

const MODEST = isModestDevice();

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const dark = system === 'dark';
  const value = useMemo(
    () => ({
      colors: dark ? darkPalette : lightPalette,
      dark,
      reduceMotion,
      lite: reduceMotion || MODEST,
    }),
    [dark, reduceMotion],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}
