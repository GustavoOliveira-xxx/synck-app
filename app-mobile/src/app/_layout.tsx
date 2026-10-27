// Raiz do app: provedores (tema, mensagens), sessão e proteção de rotas.
// Quem não está logado só acessa as telas de (auth); quem está, as de (app).
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { BrandSplash } from '@/components/brand/BrandSplash';
import { FeedbackProvider } from '@/components/Feedback';
import { isSupabaseConfigured } from '@/config/env';
import { useNetworkSync } from '@/hooks/useNetworkSync';
import { completeOAuthFromUrl } from '@/services/auth';
import { configureNotifications } from '@/services/localNotifications';
import { endSession, startSession } from '@/services/session';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import { marca } from '@/theme/marca';
import { ThemeProvider, useAppTheme } from '@/theme/ThemeProvider';
import { toFriendlyError } from '@/utils/errors';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotifications();

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppErrorBoundary {...props} />;
}

function Navigation() {
  const { colors, dark } = useAppTheme();
  const session = useAuthStore((s) => s.session);
  const navTheme = useMemo(
    () => ({
      ...(dark ? DarkTheme : DefaultTheme),
      colors: {
        ...(dark ? DarkTheme : DefaultTheme).colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.coral,
      },
    }),
    [colors, dark],
  );
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isSupabaseConfigured}>
          <Stack.Screen name="not-configured" />
        </Stack.Protected>
        <Stack.Protected guard={isSupabaseConfigured && !session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={isSupabaseConfigured && !!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const initialized = useAuthStore((s) => s.initialized);
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  useNetworkSync(!!userId);
  // Titillium Web, carregada antes de sair da splash nativa.
  const [fontsLoaded, fontError] = useFonts(marca.fonte.arquivos);
  const fontsReady = fontsLoaded || !!fontError;
  const ready = initialized && fontsReady;
  // A abertura animada fica pelo menos 0,6 s, para não piscar.
  const [minTimeDone, setMinTimeDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      useAuthStore.getState().setInitialized();
      return;
    }
    void (async () => {
      // Volta do Google no navegador: troca o ?code=... pela sessão e limpa o endereço.
      if (Platform.OS === 'web' && /[?&](code|error)=/.test(window.location.search)) {
        await completeOAuthFromUrl(window.location.href).catch((error: unknown) =>
          useAuthStore.getState().setNotice(toFriendlyError(error).message),
        );
        window.history.replaceState(null, '', window.location.pathname);
      }
      await supabase.auth
        .getSession()
        .then(({ data }) => useAuthStore.getState().setSession(data.session))
        .catch(() => useAuthStore.getState().setSession(null));
      useAuthStore.getState().setInitialized();
    })();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      useAuthStore.getState().setSession(session);
      // Sessão encerrada em outro aparelho ou expirada: limpa os dados locais.
      if (event === 'SIGNED_OUT') void endSession();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId) void startSession(userId);
  }, [userId]);

  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <FeedbackProvider>
          {ready && <Navigation />}
          {(!ready || !minTimeDone) && <BrandSplash />}
        </FeedbackProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
