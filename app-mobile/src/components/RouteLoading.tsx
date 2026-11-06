import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationLoading, endNavigation } from '@/stores/navigationLoadingStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Kairo } from './brand/Decor';
import { AppText } from './AppText';

export function RouteLoading() {
  const path = usePathname();
  const params = useGlobalSearchParams();
  const destination = JSON.stringify([path, params]);
  const previous = useRef(destination);
  const [arrived, setArrived] = useState(false);
  const { pending, inline } = useNavigationLoading();
  const waiting = useDelayedLoading(pending);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (previous.current === destination) return;
    previous.current = destination;
    endNavigation();
    // A tela já está disponível. O Kairo confirma a troca sem atrasar o próximo toque.
    setArrived(true);
    const timer = setTimeout(() => setArrived(false), 650);
    return () => clearTimeout(timer);
  }, [destination]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        endNavigation();
        setArrived(false);
      }
    });
    return () => {
      sub.remove();
      endNavigation();
    };
  }, []);
  if (inline > 0 || (!arrived && !waiting)) return null;
  return (
    <View
      pointerEvents="none"
      testID="route-loading"
      accessibilityRole="progressbar"
      accessibilityLabel={pending ? 'Abrindo página' : 'Página aberta'}
      style={[
        styles.badge,
        { top: insets.top + 8, backgroundColor: colors.surface, borderColor: colors.primary },
      ]}
    >
      <Kairo size={52} />
      <AppText variant="caption">{pending ? 'Abrindo…' : 'SynCK'}</AppText>
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
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
