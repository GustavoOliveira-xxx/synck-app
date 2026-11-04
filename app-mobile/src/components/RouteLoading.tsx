import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { usePathname, useGlobalSearchParams, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationLoading, endNavigation } from '@/stores/navigationLoadingStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Kairo } from './brand/Decor';
import { AppText } from './AppText';

export function RouteLoading() {
  const path = usePathname();
  const navigation = useRootNavigationState();
  const routeKey = JSON.stringify(navigation);
  const params = JSON.stringify(useGlobalSearchParams());
  const { pending, inline } = useNavigationLoading();
  const visible = useDelayedLoading(pending && inline === 0);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(endNavigation);
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [path, params, routeKey]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') endNavigation();
    });
    return () => {
      sub.remove();
      endNavigation();
    };
  }, []);
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      testID="route-loading"
      accessibilityRole="progressbar"
      accessibilityLabel="Abrindo página"
      style={[
        styles.badge,
        { top: insets.top + 8, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Kairo size={48} />
      <AppText variant="caption">Abrindo…</AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: 16,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
