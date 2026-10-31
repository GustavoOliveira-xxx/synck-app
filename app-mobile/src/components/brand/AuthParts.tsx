import { PressableScale } from '@/components/motion';
// Peças das telas de entrada: voltar no topo, divisória "ou" e link em linha.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, MIN_TOUCH, spacing } from '@/theme/tokens';

import { AppText } from '../AppText';
import { IconButton } from '../IconButton';

export function AuthTopBar({ right }: { right?: ReactNode }) {
  return (
    <View style={styles.top}>
      {/* Aberta direto pelo endereço (sem tela anterior): volta para as boas-vindas. */}
      <IconButton
        icon="chevron-back"
        label={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
      />
      {right}
    </View>
  );
}

export function OrDivider() {
  const { colors } = useAppTheme();
  return (
    <View style={styles.or} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <AppText variant="caption" tone="muted">
        {t('auth.or')}
      </AppText>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

/** "Novo por aqui? Criar conta" */
export function InlineLink({
  lead,
  label,
  onPress,
  align = 'center',
}: {
  lead?: string;
  label: string;
  onPress: () => void;
  align?: 'center' | 'right';
}) {
  return (
    <View style={[styles.inline, align === 'right' && styles.right]}>
      {lead ? <AppText tone="muted">{lead} </AppText> : null}
      <PressableScale
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel={label}
        hitSlop={8}
        style={styles.link}
      >
        <AppText tone="brand" style={fonte('negrito')}>
          {label}
        </AppText>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: -spacing.md,
    minHeight: MIN_TOUCH,
  },
  or: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  right: { justifyContent: 'flex-end', marginTop: -spacing.sm },
  link: { minHeight: 32, justifyContent: 'center' },
});
