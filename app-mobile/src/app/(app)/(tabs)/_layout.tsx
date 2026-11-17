import { Tabs } from 'expo-router/js-tabs';

import { useWindowDimensions } from 'react-native';

import { SynckTabBar, type TabItem } from '@/components/TabBar';
import { TabSwipe } from '@/components/TabSwipe';
import { useLayout } from '@/hooks/useLayout';
import { t } from '@/i18n';
import { beginNavigation } from '@/stores/navigationLoadingStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, motion } from '@/theme/tokens';
import { tabPath } from '@/utils/motion';

const ITEMS: TabItem[] = [
  { name: 'index', label: t('tabs.today'), icon: 'today-outline' },
  { name: 'month', label: t('tabs.calendar'), icon: 'calendar-outline' },
  { name: 'tasks', label: t('tabs.tasks'), icon: 'task-outline' },
  { name: 'calendars', label: t('tabs.calendars'), icon: 'people-outline' },
  { name: 'profile', label: t('tabs.profile'), icon: 'person-outline' },
];

const TAB_PATHS = ITEMS.map((i) => tabPath(i.name));

export default function TabsLayout() {
  const { colors, reduceMotion } = useAppTheme();
  // Tablet e computador: menu lateral. Celular: abas embaixo, ao alcance do polegar.
  const { sideNav } = useLayout();
  const { width } = useWindowDimensions();
  const shift = Math.min(width, 520) * 0.35;
  return (
    <Tabs
      tabBar={(props) => <SynckTabBar {...props} items={ITEMS} side={sideNav} />}
      screenLayout={({ children, route, navigation }) => (
        <TabSwipe
          path={tabPath(route.name)}
          tabPaths={TAB_PATHS}
          enabled={!sideNav}
          index={ITEMS.findIndex((i) => i.name === route.name)}
          count={ITEMS.length}
          onSwipe={(next) => {
            beginNavigation();
            navigation.navigate(ITEMS[next].name);
          }}
        >
          {children}
        </TabSwipe>
      )}
      screenOptions={{
        tabBarPosition: sideNav ? 'left' : 'bottom',
        headerShown: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: fonte('negrito'),
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.background },
        // Trocar de aba: a tela nova chega do lado da aba escolhida com mola e
        // quica no lugar; a antiga sai para o outro lado.
        transitionSpec: reduceMotion
          ? { animation: 'timing', config: { duration: 150 } }
          : { animation: 'spring', config: motion.molaEntrada },
        sceneStyleInterpolator: ({ current }) => ({
          sceneStyle: {
            opacity: current.progress.interpolate({
              inputRange: [-1, -0.7, -0.15, 0.15, 0.7, 1],
              outputRange: [0, 0, 1, 1, 0, 0],
            }),
            transform: reduceMotion
              ? []
              : [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [-shift, 0, shift],
                    }),
                  },
                ],
          },
        }),
      }}
    >
      {ITEMS.map((item) => (
        <Tabs.Screen key={item.name} name={item.name} options={{ title: item.label }} />
      ))}
    </Tabs>
  );
}
