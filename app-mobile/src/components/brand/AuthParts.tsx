// Peças das telas de entrada: estrutura comum (AuthShell), voltar no topo,
// divisória "ou" e link em linha.
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EnterItem, PressableScale } from '@/components/motion';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { marca } from '@/theme/marca';
import { elevation, fonte, MIN_TOUCH, radius, SCREEN_MARGIN, spacing } from '@/theme/tokens';

import { AppText } from '../AppText';
import { IconButton } from '../IconButton';
import { BrandMark } from './BrandMark';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { MistRibbons } from './Decor';

export function AuthTopBar({ right, backTo = '/welcome' }: { right?: ReactNode; backTo?: Href }) {
  return (
    <View style={styles.top}>
      {/* Aberta direto pelo endereço (sem tela anterior): volta para a tela de origem. */}
      <IconButton
        icon="chevron-back"
        label={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace(backTo))}
      />
      {right}
    </View>
  );
}

/**
 * Fundo das telas de entrada: um brilho verde que se desfaz no topo e a névoa
 * da marca embaixo. Recortado na tela (não cria rolagem para os lados) e sem
 * receber toques.
 */
export function BrandBackdrop() {
  const { colors, dark } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const glowH = Math.min(height * 0.62, 560);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <Svg width={width} height={glowH} style={styles.glow}>
        <Defs>
          <RadialGradient id="brilho" cx="50%" cy="0%" rx="70%" ry="100%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={dark ? 0.32 : 0.2} />
            <Stop offset="0.55" stopColor={colors.primary} stopOpacity={dark ? 0.1 : 0.07} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={glowH} fill="url(#brilho)" />
      </Svg>
      <MistRibbons width={width} height={Math.min(height * 0.2, 160)} style={styles.mist} />
    </View>
  );
}

/** Assinatura "um produto CK Group" com filete bronze. */
export function BrandSignature() {
  const { colors } = useAppTheme();
  return (
    <View style={styles.signature}>
      <View style={[styles.rule, { backgroundColor: colors.bronze }]} />
      <AppText variant="caption" tone="bronze">
        {marca.assinatura}
      </AppText>
    </View>
  );
}

/**
 * Estrutura das telas de entrada (login, cadastro, código, recuperar senha):
 * personagem SynCK centralizado, título e subtítulo, o formulário num cartão,
 * links embaixo e a assinatura no rodapé. Coluna de no máximo 440 no
 * computador, centralizada na altura quando sobra espaço, com halo e névoa
 * da marca no fundo.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  below,
  backTo,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Links abaixo do cartão (ex.: "Novo por aqui? Criar conta"). */
  below?: ReactNode;
  /** Para onde o voltar leva quando a tela foi aberta direto pelo endereço. */
  backTo?: Href;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const mark = width < 360 ? 76 : 96;
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <BrandBackdrop />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl },
          ]}
        >
          <View style={styles.column}>
            <AuthTopBar backTo={backTo} />
            <View style={styles.body}>
              <EnterItem index={0} style={styles.hero}>
                <BrandMark size={mark} />
                <AppText variant="display" center accessibilityRole="header">
                  {title}
                </AppText>
                {subtitle ? (
                  <AppText tone="muted" center style={styles.subtitle}>
                    {subtitle}
                  </AppText>
                ) : null}
              </EnterItem>
              <EnterItem
                index={1}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  elevation(2, colors),
                ]}
              >
                {children}
              </EnterItem>
              {below ? (
                <EnterItem index={2} style={styles.below}>
                  {below}
                </EnterItem>
              ) : null}
            </View>
            <BrandSignature />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  flex: { flex: 1 },
  clip: { overflow: 'hidden' },
  glow: { position: 'absolute', top: 0, left: 0 },
  mist: { position: 'absolute', bottom: 0, left: 0, opacity: 0.6 },
  scroll: { flexGrow: 1, paddingHorizontal: SCREEN_MARGIN },
  column: { flexGrow: 1, width: '100%', maxWidth: 440, alignSelf: 'center' },
  body: { flexGrow: 1, justifyContent: 'center', gap: spacing.xl, paddingVertical: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm },
  subtitle: { maxWidth: 340 },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  below: { gap: spacing.md, alignItems: 'center' },
  signature: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg },
  rule: { width: 40, height: 1 },
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
