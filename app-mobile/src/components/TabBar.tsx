// Navegação principal SynCK: Hoje, Calendário, Tarefas, Agendas e Perfil.
// Celular: barra embaixo; a pílula `primarySoft` escorrega até o item novo e o
// ícone pula 2 dp. Tablet e computador: menu lateral com o logo no topo.
import type { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
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
  useEffect(() => {
    if (focused && !reduceMotion) {
      y.value = withSequence(withTiming(-2, { duration: 100 }), withSpring(0, motion.mola));
    }
  }, [focused, reduceMotion, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
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
  const placed = useRef(false);
  useEffect(() => {
    if (!side && !itemWidth) return;
    if (!placed.current) {
      placed.current = true;
      pos.value = target;
      return;
    }
    pos.value = reduceMotion ? target : withSpring(target, motion.mola);
  }, [target, reduceMotion, pos, side, itemWidth]);
  const pillStyle = useAnimatedStyle(() =>
    side ? { transform: [{ translateY: pos.value }] } : { transform: [{ translateX: pos.value }] },
  );

  const press = (key: string, focused: boolean) => {
    const event = emitter.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      tapFeedback('select');
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
