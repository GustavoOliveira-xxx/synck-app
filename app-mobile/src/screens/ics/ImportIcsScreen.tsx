// Importa eventos de um arquivo .ics para uma agenda. Mostra a prévia antes,
// marca o que já foi importado (mesmo UID) e não duplica.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useCalendar } from '@/hooks/useCalendar';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useEventsMap } from '@/hooks/useEventsView';
import { t } from '@/i18n';
import { createEvent } from '@/services/eventActions';
import { goBack } from '@/services/navigation';
import { pickTextFile } from '@/services/share';
import { spacing } from '@/theme/tokens';
import { formatDateKey } from '@/utils/dates';
import { parseIcs, type ImportedEvent } from '@/utils/ics';
import { canCreateEvents } from '@/utils/permissions';
import { newEventForm } from '@/validation/event';

const MAX_IMPORT = 500;

export default function ImportIcsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const calendar = useCalendar(id);
  const events = useEventsMap();
  const display = useDisplaySettings();
  const { toast } = useFeedback();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ImportedEvent[] | null>(null);
  const [saving, setSaving] = useState(false);

  if (!calendar || !canCreateEvents(calendar)) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('errors.notFound')} />
      </Screen>
    );
  }

  const known = new Set(
    Object.values(events)
      .filter((e) => e.calendar_id === calendar.id && e.external_uid)
      .map((e) => e.external_uid as string),
  );
  const fresh = (parsed ?? []).filter((e) => !known.has(e.uid) && !e.cancelled).slice(0, MAX_IMPORT);
  const simplified = fresh.filter((e) => e.simplified).length;

  const read = (content: string) => {
    setText(content);
    setParsed(parseIcs(content, display.timezone));
  };

  const pick = async () => {
    const content = await pickTextFile('.ics,text/calendar');
    if (content) read(content);
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const e of fresh) {
        await createEvent(
          {
            ...newEventForm(calendar.id, e.timezone, e.startDate),
            title: e.title,
            description: e.description,
            location: e.location,
            url: e.url,
            allDay: e.allDay,
            startDate: e.startDate,
            startTime: e.startTime,
            endDate: e.endDate,
            endTime: e.endTime,
            recurrence: e.recurrence,
          },
          { external_uid: e.uid },
        );
      }
      toast(t('ics.imported', { n: fresh.length }));
      goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        fresh.length > 0 ? (
          <Button
            title={t('ics.importAction', { n: fresh.length })}
            icon="import-outline"
            onPress={() => void save()}
            loading={saving}
          />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: t('ics.importTitle') }} />
      <AppText>{`${t('ics.into')}: ${calendar.name}`}</AppText>
      {Platform.OS === 'web' && (
        <Button title={t('ics.pick')} icon="import-outline" variant="secondary" onPress={() => void pick()} />
      )}
      <TextField
        label={t('ics.pasteHint')}
        value={text}
        onChangeText={read}
        multiline
        numberOfLines={6}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.paste}
      />
      {parsed && parsed.length === 0 && <AppText tone="muted">{t('ics.none')}</AppText>}
      {parsed && parsed.length > 0 && (
        <>
          <AppText variant="label">{t('ics.preview', { n: parsed.length })}</AppText>
          {simplified > 0 && (
            <AppText variant="small" tone="muted">
              {t('ics.unsupported', { n: simplified })}
            </AppText>
          )}
          {parsed.slice(0, 100).map((e) => (
            <Card key={e.uid} style={styles.line}>
              <View style={styles.flex}>
                <AppText numberOfLines={1}>{e.title}</AppText>
                <AppText variant="caption" tone="muted">
                  {`${formatDateKey(e.startDate, display.dateFormat)}${e.allDay ? '' : ` ${e.startTime}`}`}
                </AppText>
              </View>
              {known.has(e.uid) && <Badge label={t('ics.duplicate')} />}
              {e.recurrence && <Badge label={t('tasks.recurring')} icon="repeat" />}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  paste: { minHeight: 120, textAlignVertical: 'top' },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
});
