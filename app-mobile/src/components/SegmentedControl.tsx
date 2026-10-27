import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useAppTheme } from '@/theme/ThemeProvider';
import { elevation, fonte, motion, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale, tapFeedback } from './motion';

/** Alternador em trilho afundado; a pílula escorrega até a opção escolhida. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const { colors, dark, reduceMotion } = useAppTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segment = width ? (width - 6) / options.length : 0;
  const x = useSharedValue(index * segment);
  // Na primeira medida a pílula já nasce no lugar; depois, escorrega.
  const placed = useRef(false);
  useEffect(() => {
    if (!segment) return;
    if (!placed.current) {
      placed.current = true;
      x.value = index * segment;
      return;
    }
    x.value = reduceMotion ? index * segment : withSpring(index * segment, motion.mola);
  }, [index, segment, reduceMotion, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.row, { backgroundColor: colors.surfaceAlt }]}
    >
      {segment > 0 && (
        <Animated.View
          style={[
            styles.pill,
            { width: segment, backgroundColor: dark ? colors.primarySoft : colors.surface },
            !dark && elevation(1, colors),
            pill,
          ]}
        />
      )}
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <PressableScale
            key={opt.value}
            onPress={() => {
              if (!selected) tapFeedback('select');
              onChange(opt.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            style={styles.item}
          >
            <AppText
              variant="label"
              maxFontSizeMultiplier={1.4}
              style={{
                ...fonte(selected ? 'negrito' : 'semi'),
                color: selected ? (dark ? colors.primaryInk : colors.text) : colors.textMuted,
              }}
            >
              {opt.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: radius.pill, padding: 3 },
  pill: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: radius.pill },
  item: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
  },
});
