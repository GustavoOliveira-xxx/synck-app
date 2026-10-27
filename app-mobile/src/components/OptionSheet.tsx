import { PressableScale } from '@/components/motion';
import { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '@/hooks/useLayout';

import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { DIALOG_MAX_WIDTH } from '@/utils/layout';
import { normalizeText } from '@/utils/text';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface Option<T> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Lista de opções em uma folha (modal), com busca opcional (ex.: fusos horários). */
export function OptionSheet<T>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  searchable,
  searchPlaceholder,
}: {
  visible: boolean;
  title: string;
  options: Option<T>[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const { colors, reduceMotion } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Celular: a lista sobe de baixo. Tablet e computador: cartão no centro da tela.
  const { centeredSheets } = useLayout();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return q
      ? options.filter((o) => normalizeText(`${o.label} ${o.description ?? ''}`).includes(q))
      : options;
  }, [options, query]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : centeredSheets ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.backdrop,
          centeredSheets && styles.backdropCentered,
          { backgroundColor: colors.overlay },
        ]}
      >
        <View
          style={[
            styles.sheet,
            centeredSheets && styles.sheetCentered,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md },
          ]}
          accessibilityViewIsModal
        >
          {!centeredSheets && <View style={[styles.grabber, { backgroundColor: colors.border }]} />}
          <View style={styles.header}>
            <AppText variant="heading" style={styles.flex}>
              {title}
            </AppText>
            <IconButton icon="close" label={t('common.close')} onPress={onClose} />
          </View>
          {searchable && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder ?? t('common.search')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={searchPlaceholder ?? t('common.search')}
              autoCorrect={false}
              style={[
                styles.search,
                typography.body,
                { color: colors.text, borderColor: colors.inputBorder },
              ]}
            />
          )}
          <FlatList
            data={filtered}
            keyExtractor={(item, index) => `${String(item.value)}-${index}`}
            initialNumToRender={30}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <PressableScale
                  scaleTo={0.99}
                  disabled={item.disabled}
                  onPress={() => {
                    onSelect(item.value);
                    onClose();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: !!item.disabled }}
                  accessibilityLabel={item.description ? `${item.label}. ${item.description}` : item.label}
                  style={[
                    styles.option,
                    {
                      backgroundColor: 'transparent',
                      opacity: item.disabled ? 0.45 : 1,
                    },
                  ]}
                >
                  <View style={styles.flex}>
                    <AppText style={fonte(selected ? 'semi' : 'regular')}>{item.label}</AppText>
                    {item.description ? (
                      <AppText variant="small" tone="muted">
                        {item.description}
                      </AppText>
                    ) : null}
                  </View>
                  {selected && <Icon name="checkmark-circle" color={colors.primary} />}
                </PressableScale>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropCentered: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  sheetCentered: { width: '100%', maxWidth: DIALOG_MAX_WIDTH, borderRadius: radius.lg },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, paddingRight: spacing.xs },
  flex: { flex: 1 },
  search: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: MIN_TOUCH,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  option: {
    minHeight: MIN_TOUCH + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
