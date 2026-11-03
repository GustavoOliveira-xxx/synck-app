import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { SvgArtwork } from './Icon';
import { PressableScale } from './motion';

export const DECORATIONS = {
  'decor-sol': 'Sol',
  'decor-lua': 'Lua',
  'decor-flor': 'Flor',
  'decor-folha': 'Folha',
  'decor-onda': 'Onda',
  'decor-montanha': 'Montanha',
  'decor-orbita': 'Órbita',
  'decor-coracao': 'Coração',
  'decor-livro': 'Livro',
  'decor-cafe': 'Café',
  'decor-laco': 'Laço',
  'decor-cometa': 'Cometa',
} as const;
export type DecorationName = keyof typeof DECORATIONS;
export function Decoration({
  name,
  color,
  size = 24,
}: {
  name?: string | null;
  color?: string;
  size?: number;
}) {
  const { colors } = useAppTheme();
  if (!name || !Object.hasOwn(DECORATIONS, name)) return null;
  return <SvgArtwork name={name as DecorationName} color={color ?? colors.primaryInk} size={size} />;
}
export function DecorationPicker({
  value,
  onChange,
  color,
}: {
  value?: string | null;
  onChange: (value: DecorationName | null) => void;
  color?: string;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Decoração do item"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen((v) => !v)}
        style={[styles.preview, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Decoration name={value ?? 'decor-flor'} color={color} size={32} />
        <View style={{ flex: 1 }}>
          <AppText variant="label">Decoração</AppText>
          <AppText variant="small" tone="muted">
            {value && Object.hasOwn(DECORATIONS, value)
              ? DECORATIONS[value as DecorationName]
              : 'Escolha um desenho para reconhecer este item'}
          </AppText>
        </View>
        <AppText variant="small">{open ? 'Fechar' : 'Escolher'}</AppText>
      </PressableScale>
      {open && (
        <>
          <AppText variant="small" tone="muted">
            Combine um desenho com a cor para identificar pessoas, planos ou momentos. Você pode trocar
            depois.
          </AppText>
          <PressableScale
            accessibilityRole="radio"
            accessibilityLabel="Sem decoração"
            accessibilityState={{ checked: !value }}
            aria-checked={!value}
            onPress={() => onChange(null)}
            style={[
              styles.preview,
              {
                minHeight: 48,
                borderColor: !value ? colors.primary : colors.border,
                backgroundColor: !value ? colors.primarySoft : colors.surface,
              },
            ]}
          >
            <AppText variant="label">Sem decoração</AppText>
          </PressableScale>
          <View style={styles.grid}>
            {Object.entries(DECORATIONS).map(([name, label]) => (
              <PressableScale
                key={name}
                accessibilityRole="radio"
                accessibilityLabel={`Decoração: ${label}`}
                accessibilityState={{ checked: value === name }}
                aria-checked={value === name}
                onPress={() => onChange(name as DecorationName)}
                style={[
                  styles.tile,
                  {
                    borderColor: value === name ? colors.primary : colors.border,
                    backgroundColor: value === name ? colors.primarySoft : colors.surface,
                  },
                ]}
              >
                <Decoration name={name} color={color} size={30} />
                <AppText variant="caption">{label}</AppText>
              </PressableScale>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: 76,
    minHeight: 76,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
});
