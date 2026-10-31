import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BrandMark } from '@/components/brand/BrandMark';
import { StarBurst } from '@/components/brand/Decor';
import { Button } from '@/components/Button';
import { EnterItem, tapFeedback } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { strings, t } from '@/i18n';
import type { Role } from '@/models/types';
import { spacing } from '@/theme/tokens';

export default function InviteAcceptedScreen() {
  const { calendarId, name, role } = useLocalSearchParams<{
    calendarId: string;
    name?: string;
    role?: Role;
  }>();
  // Comemoração: as estrelas estouram quando a tela aparece.
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      tapFeedback('success');
      setBurst(1);
    }, 350);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Screen stagger={false}>
      <Stack.Screen options={{ title: '' }} />
      <View style={styles.hero}>
        <BrandMark size={150} />
        <StarBurst trigger={burst} size={110} />
      </View>
      <EnterItem index={1} style={styles.texts}>
        <AppText variant="display" center>
          {t('invites.acceptedTitle')}
        </AppText>
        <AppText center tone="muted">
          {t('invites.acceptedMessage', { calendar: name ?? '', role: role ? strings.roles[role] : '' })}
        </AppText>
      </EnterItem>
      <EnterItem index={2} style={styles.actions}>
        <Button
          title={t('invites.openCalendar')}
          icon="calendar-outline"
          onPress={() => router.replace({ pathname: '/calendar/[id]', params: { id: calendarId } })}
        />
        <Button title={t('tabs.calendar')} variant="secondary" onPress={() => router.navigate('/month')} />
      </EnterItem>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', justifyContent: 'center', marginTop: spacing.xxl },
  texts: { gap: spacing.sm, alignItems: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
