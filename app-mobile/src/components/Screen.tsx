import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/ThemeProvider';
import { SCREEN_MARGIN, spacing } from '@/theme/tokens';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';

import { EnterItem } from './motion';
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
  /** Blocos entram em cascata ao abrir a tela (padrão, só em telas com rolagem). */
  stagger?: boolean;
}

/** Altura livre no fim da rolagem quando há botão flutuante (56 do botão + margens). */
const FAB_CLEARANCE = 120;

/**
 * Filhos diretos, com os fragmentos abertos (cada bloco entra no seu tempo).
 * As chaves seguem a posição no código, não na tela: um bloco que aparece ou
 * some (ex.: uma mensagem de erro) não faz os de baixo serem recriados, então
 * campos de texto não perdem o foco nem o que foi digitado.
 */
function flatten(children: ReactNode, prefix = ''): { key: string; node: ReactNode }[] {
  return Children.toArray(children).flatMap((child, i) => {
    const key = `${prefix}${isValidElement(child) && child.key != null ? child.key : i}`;
    return isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flatten(child.props.children, `${key}/`)
      : [{ key, node: child }];
  });
}

/** Cada bloco da tela sobe e aparece, um depois do outro. */
export function Cascade({ children }: { children: ReactNode }) {
  let index = 0;
  return flatten(children).map(({ key, node }) =>
    // Opções da barra de título não desenham nada: ficam fora da cascata.
    isValidElement(node) && node.type === Stack.Screen ? (
      <Fragment key={key}>{node}</Fragment>
    ) : (
      <EnterItem key={key} index={index++}>
        {node}
      </EnterItem>
    ),
  );
}

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
  stagger = true,
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
      {stagger ? <Cascade>{children}</Cascade> : children}
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
