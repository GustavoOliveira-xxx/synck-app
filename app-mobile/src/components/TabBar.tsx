import { beginNavigation } from '@/stores/navigationLoadingStore';
// Navegação principal SynCK: Hoje, Calendário, Tarefas, Agendas e Perfil.
// Celular: barra embaixo; a pílula `primarySoft` escorrega até o item novo e o
// ícone pula 2 dp. Tablet e computador: menu lateral com o logo no topo.
import type { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, motion, radius, spacing } from '@/theme/tokens';
import { marca } from '@/theme/marca';

import { AppText } from './AppText';
import { Logo } from './brand/Logo';
import { Icon, type IconName } from './Icon';
import { PressableScale, tapFeedback } from './motion';

export interface TabItem {
  name: string;
  label: string;
  icon: IconName;
  /** Rótulo para leitores de tela (ex.: com o número de avisos). */
  a11yLabel?: string;
}

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const PILL_W = 60;
const PILL_H = 32;
const SIDE_ITEM_H = 48;

function TabIcon({ icon, focused, color }: { icon: IconName; focused: boolean; color: string }) {
  const { reduceMotion } = useAppTheme();
  const y = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  useEffect(() => {
    if (!focused || reduceMotion) return;
    // Pulo: sobe esticado, cai achatado e balança até parar.
    y.value = withSequence(
      withTiming(-9, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 130, easing: Easing.in(Easing.quad) }),
    );
    sx.value = withSequence(
      withTiming(0.9, { duration: 140 }),
      withTiming(1.22, { duration: 130 }),
      withSpring(1, motion.mola),
    );
    sy.value = withSequence(
      withTiming(1.14, { duration: 140 }),
      withTiming(0.8, { duration: 130 }),
      withSpring(1, motion.mola),
    );
  }, [focused, reduceMotion, y, sx, sy]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scaleX: sx.value }, { scaleY: sy.value }],
  }));
  return (
    <Animated.View style={style}>
      <Icon name={icon} size={24} color={color} />
    </Animated.View>
  );
}

export function SynckTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
  items,
  side,
}: BottomTabBarProps & { items: TabItem[]; side: boolean }) {
  const { colors, reduceMotion } = useAppTheme();
  const [itemWidth, setItemWidth] = useState(0);
  const routes = state.routes.filter((r) => items.some((i) => i.name === r.name));
  const activeName = state.routes[state.index]?.name;
  const activeIndex = Math.max(
    0,
    routes.findIndex((r) => r.name === activeName),
  );

  const target = side
    ? activeIndex * (SIDE_ITEM_H + spacing.xs)
    : activeIndex * itemWidth + (itemWidth - PILL_W) / 2;
  const pos = useSharedValue(target);
  // Esticada da pílula no caminho: estica no sentido do movimento e achata no outro.
  const stretch = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!side && !itemWidth) return;
    if (!placed.current) {
      placed.current = true;
      pos.value = target;
      return;
    }
    if (reduceMotion) {
      pos.value = target;
      return;
    }
    pos.value = withSpring(target, motion.molaEntrada);
    stretch.value = withSequence(withTiming(1, { duration: 120 }), withSpring(0, motion.mola));
  }, [target, reduceMotion, pos, stretch, side, itemWidth]);
  const pillStyle = useAnimatedStyle(() => {
    const k = stretch.value * 0.45;
    return side
      ? { transform: [{ translateY: pos.value }, { scaleY: 1 + k }, { scaleX: 1 - k * 0.3 }] }
      : { transform: [{ translateX: pos.value }, { scaleX: 1 + k }, { scaleY: 1 - k * 0.6 }] };
  });

  const press = (key: string, focused: boolean) => {
    const event = emitter.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      tapFeedback('select');
      beginNavigation();
      navigateToTab(key);
    }
  };

  if (side) {
    return (
      <View
        style={[
          styles.side,
          {
            backgroundColor: colors.surface,
            borderRightColor: colors.border,
            paddingTop: insets.top + spacing.xxl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <Logo kind="horizontal" width={168} style={styles.sideLogo} />
        <View role="tablist" style={styles.sideList}>
          <Animated.View
            style={[styles.sidePill, { backgroundColor: colors.primarySoft, height: SIDE_ITEM_H }, pillStyle]}
          />
          {routes.map((route, index) => {
            const item = items.find((i) => i.name === route.name)!;
            const focused = index === activeIndex;
            const color = focused ? colors.primaryInk : colors.textMuted;
            return (
              <PressableScale
                key={route.key}
                role="tab"
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={item.a11yLabel ?? item.label}
                testID={descriptors[route.key]?.options.tabBarButtonTestID}
                onPress={() => press(route.key, focused)}
                style={styles.sideItem}
              >
                <TabIcon icon={item.icon} focused={focused} color={color} />
                <AppText style={{ color, fontSize: 15, ...fonte(focused ? 'negrito' : 'semi') }}>
                  {item.label}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
        <View style={styles.sideFooter}>
          <View style={[styles.rule, { backgroundColor: colors.bronze }]} />
          <AppText variant="caption" tone="bronze">
            {marca.assinatura}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View
      role="tablist"
      onLayout={(e) => setItemWidth(e.nativeEvent.layout.width / Math.max(1, routes.length))}
      style={[
        styles.bottom,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom + spacing.sm,
        },
      ]}
    >
      {itemWidth > 0 && (
        <Animated.View style={[styles.bottomPill, { backgroundColor: colors.primarySoft }, pillStyle]} />
      )}
      {routes.map((route, index) => {
        const item = items.find((i) => i.name === route.name)!;
        const focused = index === activeIndex;
        const color = focused ? colors.primaryInk : colors.textMuted;
        return (
          <PressableScale
            key={route.key}
            role="tab"
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.a11yLabel ?? item.label}
            testID={descriptors[route.key]?.options.tabBarButtonTestID}
            onPress={() => press(route.key, focused)}
            style={styles.bottomItem}
          >
            <View style={styles.bottomIcon}>
              <TabIcon icon={item.icon} focused={focused} color={color} />
            </View>
            <AppText
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              style={{ color, fontSize: 12, lineHeight: 16, ...fonte(focused ? 'negrito' : 'semi') }}
            >
              {item.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  bottomPill: {
    position: 'absolute',
    top: spacing.sm,
    left: 0,
    width: PILL_W,
    height: PILL_H,
    borderRadius: radius.pill,
  },
  bottomItem: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52 },
  bottomIcon: { height: PILL_H, justifyContent: 'center' },
  side: { width: 248, borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.lg },
  sideLogo: { marginLeft: spacing.sm, marginBottom: spacing.xxl },
  sideList: { gap: spacing.xs },
  sidePill: { position: 'absolute', left: 0, right: 0, top: 0, borderRadius: radius.pill },
  sideItem: {
    height: SIDE_ITEM_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  sideFooter: { marginTop: 'auto', gap: spacing.sm, paddingHorizontal: spacing.sm },
  rule: { width: 32, height: 1 },
});
