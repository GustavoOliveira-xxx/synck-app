import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/ThemeProvider';
import { SCREEN_MARGIN, spacing } from '@/theme/tokens';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';

import { OfflineBanner } from './OfflineBanner';

interface ScreenProps {
  children: ReactNode;
  /** Rolar o conteúdo (padrão). Use false para telas com listas próprias. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  footer?: ReactNode;
  showOfflineBanner?: boolean;
  /** Largura máxima do conteúdo em telas grandes (tablet, computador). */
  maxWidth?: number;
  /** Respeitar a área do topo (telas sem barra de título). */
  safeTop?: boolean;
  /** A tela tem o botão flutuante "+": deixa espaço no fim para ele não cobrir o último item. */
  withFab?: boolean;
}

/** Altura livre no fim da rolagem quando há botão flutuante (56 do botão + margens). */
const FAB_CLEARANCE = 120;

/** Estrutura padrão de tela: fundo, margens, rolagem e aviso de sem internet. */
export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  padded = true,
  footer,
  showOfflineBanner = true,
  maxWidth = CONTENT_MAX_WIDTH,
  safeTop,
  withFab,
}: ScreenProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Em telas largas o conteúdo fica numa coluna centralizada, em vez de esticar.
  const column = [styles.column, { maxWidth }];
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[
        column,
        padded && styles.padded,
        { paddingBottom: (withFab ? FAB_CLEARANCE : spacing.huge) + insets.bottom },
        safeTop && { paddingTop: insets.top + spacing.lg },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flex,
        column,
        padded && styles.padded,
        safeTop && { paddingTop: insets.top + spacing.lg },
      ]}
    >
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {showOfflineBanner && <OfflineBanner />}
      {content}
      {footer && (
        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
              paddingBottom: spacing.md + insets.bottom,
            },
          ]}
        >
          <View style={[column, styles.footerContent]}>{footer}</View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', alignSelf: 'center' },
  padded: { paddingHorizontal: SCREEN_MARGIN, paddingTop: spacing.lg, gap: spacing.lg },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SCREEN_MARGIN,
    paddingTop: spacing.md,
  },
  footerContent: { gap: spacing.sm },
});
