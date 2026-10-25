// Anotações: pessoais e das agendas (ideias, endereços, combinados), com
// busca e as fixadas no topo. ?calendarId= mostra só as de uma agenda.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { FAB } from '@/components/FAB';
import { Icon } from '@/components/Icon';
import { EnterItem } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap } from '@/hooks/useEventsView';
import { useNotes } from '@/hooks/useItems';
import { useNow } from '@/hooks/useNow';
import { t } from '@/i18n';
import type { Note } from '@/models/types';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { formatRelative } from '@/utils/dates';
import { normalizeText } from '@/utils/text';

export function noteTitle(note: Note): string {
  return note.title?.trim() || note.body.trim().split('\n')[0].slice(0, 80) || t('notes.untitled');
}

export default function NotesScreen() {
  const params = useLocalSearchParams<{ calendarId?: string }>();
  const { colors } = useAppTheme();
  const display = useDisplaySettings();
  const now = useNow();
  const notes = useNotes();
  const calendars = useCalendarsMap();
  const [query, setQuery] = useState('');
  const [calendarId, setCalendarId] = useState<string | null>(params.calendarId || null);

  const shown = useMemo(() => {
    const q = normalizeText(query);
    return notes.filter(
      (n) =>
        (calendarId === null ||
          (calendarId === 'personal' ? !n.calendar_id : n.calendar_id === calendarId)) &&
        (!q || normalizeText(`${n.title ?? ''} ${n.body}`).includes(q)),
    );
  }, [notes, query, calendarId]);
  const pinned = shown.filter((n) => n.pinned);
  const others = shown.filter((n) => !n.pinned);
  const usedCalendars = [...new Set(notes.map((n) => n.calendar_id).filter(Boolean))] as string[];

  const card = (n: Note, i: number) => (
    <EnterItem key={n.id} index={i}>
      <Card
        onPress={() => router.push({ pathname: '/notes/[id]', params: { id: n.id } })}
        accessibilityLabel={`${noteTitle(n)}${n.pinned ? `. ${t('notes.pinned')}` : ''}`}
        style={styles.gap}
      >
        <View style={styles.row}>
          {n.pinned && <Icon name="star-outline" size={16} color={colors.primaryInk} />}
          <AppText variant="heading" numberOfLines={1} style={styles.flex}>
            {noteTitle(n)}
          </AppText>
          {n.pending && <Icon name="cloud-upload-outline" size={14} color={colors.textMuted} />}
        </View>
        {n.body.trim() ? (
          <AppText variant="small" tone="muted" numberOfLines={3}>
            {n.body.trim()}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="muted">
          {[
            n.calendar_id ? calendars[n.calendar_id]?.name : t('tasks.personal'),
            t('notes.updatedAt', {
              when: formatRelative(new Date(n.updated_at), now, display.timezone, display.dateFormat),
            }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </Card>
    </EnterItem>
  );

  return (
    <View style={styles.flex}>
      <Screen withFab>
        <Stack.Screen
          options={{
            title: params.calendarId
              ? `${t('notes.title')} · ${calendars[params.calendarId]?.name ?? ''}`
              : t('notes.title'),
          }}
        />
        <TextField label={t('notes.search')} value={query} onChangeText={setQuery} icon="search" />
        {!params.calendarId && usedCalendars.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip
              label={t('search.all')}
              selected={calendarId === null}
              onPress={() => setCalendarId(null)}
            />
            <Chip
              label={t('tasks.personal')}
              selected={calendarId === 'personal'}
              onPress={() => setCalendarId('personal')}
            />
            {usedCalendars.map((id) => (
              <Chip
                key={id}
                label={calendars[id]?.name ?? ''}
                selected={calendarId === id}
                onPress={() => setCalendarId(id)}
              />
            ))}
          </ScrollView>
        )}
        {shown.length === 0 ? (
          <EmptyState art="sphere" title={t('notes.empty')} message={t('notes.emptyMessage')} />
        ) : (
          <>
            {pinned.length > 0 && <SectionHeader title={t('notes.pinned')} />}
            {pinned.map(card)}
            {pinned.length > 0 && others.length > 0 && <SectionHeader title={t('notes.others')} />}
            {others.map(card)}
          </>
        )}
      </Screen>
      <FAB
        label={t('notes.new')}
        onPress={() =>
          router.push({ pathname: '/notes/new', params: { calendarId: params.calendarId ?? '' } })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
});
