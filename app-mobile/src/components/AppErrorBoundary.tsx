import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { isChunkLoadError, reloadForNewVersion, shouldReloadForNewVersion } from '@/services/appUpdate';
import { logError } from '@/services/errorLog';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

/**
 * Tela de erro inesperado: nunca mostra detalhes técnicos (stack trace) à pessoa.
 * Se o erro for uma tela da versão anterior que não existe mais (o site foi
 * atualizado com o app aberto), recarrega sozinho para abrir a versão nova.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useAppTheme();
  const outdated = isChunkLoadError(error);
  // Recarregou há pouco e o arquivo continua faltando: mostra a tela de erro.
  const [reload] = useState(() => outdated && shouldReloadForNewVersion());
  useEffect(() => {
    void logError(outdated ? 'versão nova' : 'tela', error);
    if (reload) reloadForNewVersion();
  }, [error, outdated, reload]);
  if (reload) return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Icon name="sad-outline" size={56} color={colors.textMuted} />
      <AppText variant="title" center>
        {t('errors.genericTitle')}
      </AppText>
      <AppText tone="muted" center>
        {t('errors.unexpectedScreen')}
      </AppText>
      <Button
        title={t('common.retry')}
        icon="refresh"
        onPress={() => {
          if (outdated && shouldReloadForNewVersion()) reloadForNewVersion();
          else retry();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.lg,
  },
});
