import { PressableScale } from '@/components/motion';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { HELP_TOPICS } from '@/content/help';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function HelpScreen() {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen>
      <Stack.Screen options={{ title: t('help.title') }} />
      {HELP_TOPICS.map((topic, index) => {
        const expanded = open === index;
        return (
          <Card key={topic.question}>
            <PressableScale
              onPress={() => setOpen(expanded ? null : index)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}
            >
              <AppText variant="label" style={{ flex: 1 }}>
                {topic.question}
              </AppText>
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} color={colors.textMuted} />
            </PressableScale>
            {expanded && <AppText>{topic.answer}</AppText>}
          </Card>
        );
      })}
    </Screen>
  );
}
