import { Tabs } from 'expo-router/js-tabs';

import { SynckTabBar, type TabItem } from '@/components/TabBar';
import { useLayout } from '@/hooks/useLayout';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte } from '@/theme/tokens';

const ITEMS: TabItem[] = [
  { name: 'index', label: t('tabs.today'), icon: 'today-outline' },
  { name: 'month', label: t('tabs.calendar'), icon: 'calendar-outline' },
  { name: 'tasks', label: t('tabs.tasks'), icon: 'task-outline' },
  { name: 'calendars', label: t('tabs.calendars'), icon: 'people-outline' },
  { name: 'profile', label: t('tabs.profile'), icon: 'person-outline' },
];

export default function TabsLayout() {
  const { colors, reduceMotion } = useAppTheme();
  // Tablet e computador: menu lateral. Celular: abas embaixo, ao alcance do polegar.
  const { sideNav } = useLayout();
  return (
    <Tabs
      tabBar={(props) => <SynckTabBar {...props} items={ITEMS} side={sideNav} />}
      screenOptions={{
        tabBarPosition: sideNav ? 'left' : 'bottom',
        headerShown: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: fonte('negrito'),
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.background },
        // Trocar de aba desliza a tela de leve para o lado da aba escolhida.
        animation: reduceMotion ? 'fade' : 'shift',
      }}
    >
      {ITEMS.map((item) => (
        <Tabs.Screen key={item.name} name={item.name} options={{ title: item.label }} />
      ))}
    </Tabs>
  );
}
