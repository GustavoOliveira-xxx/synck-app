import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { t } from '@/i18n';
import { endNavigation, useNavigationLoading } from '@/stores/navigationLoadingStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { Kairo, MistRibbons } from './brand/Decor';
import { Button } from './Button';

export function RouteLoading({ enabled }: { enabled: boolean }) {
  const path = usePathname();
  const params = useGlobalSearchParams();
  const destination = JSON.stringify([path, params]);
  const previous = useRef(destination);
  const [arrived, setArrived] = useState(false);
  const { pending, screens, revealed } = useNavigationLoading();
  const waiting = useDelayedLoading(pending || screens.length > 0);
  const visible = enabled && !revealed && (arrived || waiting);
  const canReveal = useDelayedLoading(visible, 2000);
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (previous.current === destination) return;
    previous.current = destination;
    endNavigation();
    useNavigationLoading.setState({ revealed: false });
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

  if (!visible) return null;
  const message = screens[screens.length - 1]?.message ?? t('common.loading');
  const reveal = () => {
    setArrived(false);
    endNavigation();
    useNavigationLoading.setState({ revealed: true });
  };

  return (
    <Modal visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={reveal}>
      <View testID="route-loading" style={[styles.screen, { backgroundColor: colors.background }]}>
        <MistRibbons width={width} height={height * 0.2} paused style={styles.ribbons} />
        <View accessibilityRole="progressbar" accessibilityLabel={message} style={styles.center}>
          <Kairo size={Math.min(width * 0.38, height * 0.32, 184)} />
          <AppText tone="muted">{message}</AppText>
        </View>
        {canReveal && (
          <View style={styles.action}>
            <Button title="Mostrar página" variant="secondary" onPress={reveal} />
          </View>
        )}
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: { alignItems: 'center', gap: 12 },
  ribbons: { position: 'absolute', bottom: 0 },
  action: { position: 'absolute', bottom: '10%' },
});
