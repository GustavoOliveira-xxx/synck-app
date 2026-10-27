// Diálogo de confirmação (ações destrutivas) e mensagens rápidas (toast).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Modal, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { PressableScale, MotionView } from './motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { elevation, fonte, MIN_TOUCH, motion, radius, spacing, typography } from '@/theme/tokens';
import { centeredInset, DIALOG_MAX_WIDTH } from '@/utils/layout';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Exige digitar esta palavra para liberar o botão (ex.: EXCLUIR). */
  typeToConfirm?: string;
  /** Opções extras além de confirmar/cancelar (ex.: escopo de recorrência). */
  choices?: { value: string; label: string; destructive?: boolean }[];
}

type ConfirmResult = boolean | string;

export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface FeedbackApi {
  confirm: (options: ConfirmOptions) => Promise<ConfirmResult>;
  toast: (message: string, tone?: 'success' | 'error' | 'info', action?: ToastAction) => void;
}

const FeedbackContext = createContext<FeedbackApi>({
  confirm: async () => false,
  toast: () => undefined,
});

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { colors, reduceMotion } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Mensagem rápida: largura de celular, centralizada em telas grandes.
  const toastInset = centeredInset(useWindowDimensions().width, DIALOG_MAX_WIDTH, spacing.lg);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (r: ConfirmResult) => void }) | null>(
    null,
  );
  const [typed, setTyped] = useState('');
  const [toastState, setToastState] = useState<{
    message: string;
    tone: 'success' | 'error' | 'info';
    action?: ToastAction;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<ConfirmResult>((resolve) => {
        setTyped('');
        setDialog({ ...options, resolve });
      }),
    [],
  );

  const toast = useCallback(
    (message: string, tone: 'success' | 'error' | 'info' = 'success', action?: ToastAction) => {
      if (timer.current) clearTimeout(timer.current);
      setToastState({ message, tone, action });
      AccessibilityInfo.announceForAccessibility(message);
      // Com ação (ex.: Desfazer), a mensagem fica mais tempo na tela.
      timer.current = setTimeout(() => setToastState(null), action ? 7000 : 3500);
    },
    [],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const close = (result: ConfirmResult) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  const locked = !!dialog?.typeToConfirm && typed.trim() !== dialog.typeToConfirm;

  return (
    <FeedbackContext.Provider value={{ confirm, toast }}>
      {children}
      <Modal
        visible={!!dialog}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => close(false)}
      >
        <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialog, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
            <AppText variant="title">{dialog?.title}</AppText>
            {dialog?.message ? <AppText tone="muted">{dialog.message}</AppText> : null}
            {dialog?.typeToConfirm ? (
              <TextInput
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={t('account.deleteTypeToConfirm')}
                placeholder={dialog.typeToConfirm}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  typography.body,
                  { borderColor: colors.inputBorder, color: colors.text },
                ]}
              />
            ) : null}
            <View style={styles.actions}>
              {dialog?.choices?.map((c) => (
                <Button
                  key={c.value}
                  title={c.label}
                  variant={c.destructive ? 'danger' : 'secondary'}
                  onPress={() => close(c.value)}
                />
              ))}
              {!dialog?.choices && (
                <Button
                  title={dialog?.confirmLabel ?? t('common.confirm')}
                  variant={dialog?.destructive ? 'danger' : 'primary'}
                  disabled={locked}
                  onPress={() => close(true)}
                />
              )}
              <Button
                title={dialog?.cancelLabel ?? t('common.cancel')}
                variant="ghost"
                onPress={() => close(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
      {toastState && (
        <MotionView
          key={toastState.message}
          entering={
            reduceMotion
              ? FadeIn.duration(150)
              : SlideInDown.springify().stiffness(motion.mola.stiffness).damping(motion.mola.damping)
          }
          exiting={reduceMotion ? FadeOut.duration(150) : SlideOutDown.duration(200)}
          pointerEvents={toastState.action ? 'box-none' : 'none'}
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            elevation(3, colors),
            {
              bottom: insets.bottom + 88,
              left: toastInset,
              right: toastInset,
              backgroundColor: toastState.tone === 'error' ? colors.danger : colors.text,
            },
          ]}
        >
          <Icon
            name={
              toastState.tone === 'error'
                ? 'alert-circle-outline'
                : toastState.tone === 'info'
                  ? 'notifications-outline'
                  : 'sync'
            }
            size={20}
            color={toastState.tone === 'error' ? colors.dangerText : colors.background}
          />
          <AppText
            style={{
              color: toastState.tone === 'error' ? colors.dangerText : colors.background,
              ...fonte('semi'),
              flex: 1,
            }}
          >
            {toastState.message}
          </AppText>
          {toastState.action ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={toastState.action.label}
              onPress={() => {
                toastState.action?.onPress();
                setToastState(null);
              }}
              style={styles.toastAction}
            >
              <AppText
                style={{
                  color: toastState.tone === 'error' ? colors.dangerText : colors.accentInverse,
                  ...fonte('negrito'),
                }}
              >
                {toastState.action.label}
              </AppText>
            </PressableScale>
          ) : null}
        </MotionView>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  return useContext(FeedbackContext);
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  dialog: {
    width: '100%',
    maxWidth: DIALOG_MAX_WIDTH,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    gap: spacing.md,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  input: { borderWidth: 1.5, borderRadius: radius.sm, minHeight: MIN_TOUCH, paddingHorizontal: spacing.md },
  toast: {
    position: 'absolute',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toastAction: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: spacing.sm },
});
