// Boas-vindas: logo SynCK com o halo da marca, a frase do produto e as três
// saídas (criar conta, Google, já tenho conta). Mesma estrutura visual das
// demais telas de entrada.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { BrandBackdrop, BrandSignature } from '@/components/brand/AuthParts';
import { GoogleButton } from '@/components/brand/GoogleButton';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/Button';
import { EnterItem } from '@/components/motion';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { SCREEN_MARGIN, spacing } from '@/theme/tokens';

export default function WelcomeScreen() {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const [message, setMessage] = useState<string | null>(null);
  // O logo acompanha a tela, sem passar de 300 nem tomar mais de 40% da altura.
  const logo = Math.min(width * 0.62, 300, height * 0.4 * (200 / 179)) * (width < 360 ? 0.9 : 1);
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <BrandBackdrop />
      <SafeAreaView style={styles.container}>
        <View style={styles.hero}>
          <EnterItem index={0}>
            <Logo kind="vertical" width={logo} />
          </EnterItem>
          <EnterItem index={1}>
            <AppText variant="display" center style={styles.tagline}>
              {t('auth.welcomeSubtitle')}
            </AppText>
          </EnterItem>
        </View>
        <EnterItem index={2} style={styles.actions}>
          <Button
            title={t('auth.createAccount')}
            onPress={() => router.push('/signup')}
            testID="welcome-signup"
          />
          <GoogleButton onError={setMessage} />
          {message ? (
            <AppText tone="danger" center accessibilityLiveRegion="assertive">
              {message}
            </AppText>
          ) : null}
          <Button
            title={t('auth.haveAccount')}
            variant="ghost"
            onPress={() => router.push('/login')}
            testID="welcome-login"
          />
          <BrandSignature />
        </EnterItem>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.lg },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl },
  tagline: { maxWidth: 360 },
  actions: { gap: spacing.md, width: '100%', maxWidth: 440, alignSelf: 'center' },
});
