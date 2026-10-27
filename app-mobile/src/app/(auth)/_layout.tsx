import { IconButton } from '@/components/IconButton';
import { Stack } from 'expo-router';

import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte } from '@/theme/tokens';

export default function AuthLayout() {
  const { colors, reduceMotion } = useAppTheme();
  return (
    <Stack
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: fonte('negrito'),
        animation: reduceMotion ? 'none' : 'slide_from_right',
        headerBackButtonDisplayMode: 'minimal',
        headerBackVisible: false,
        headerLeft: navigation.canGoBack()
          ? () => (
              <IconButton icon="chevron-back" label={t('common.back')} onPress={() => navigation.goBack()} />
            )
          : undefined,
        contentStyle: { backgroundColor: colors.background },
      })}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: t('auth.login'), headerShown: false }} />
      <Stack.Screen name="signup" options={{ title: t('auth.signup'), headerShown: false }} />
      <Stack.Screen name="verify-email" options={{ title: t('auth.verifyTitle') }} />
      <Stack.Screen name="forgot-password" options={{ title: t('auth.forgotTitle') }} />
      <Stack.Screen name="privacy" options={{ title: t('privacyPolicy.title') }} />
    </Stack>
  );
}
