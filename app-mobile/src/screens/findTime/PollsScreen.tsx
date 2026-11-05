// Enquetes de horário de uma agenda: cada participante vota (posso, talvez,
// não posso); quem criou encerra e escolhe o horário, que vira evento.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { useFeedback } from '@/components/Feedback';
import { OptionSheet } from '@/components/OptionSheet';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useDataStore } from '@/stores/dataStore';
import { useAction } from '@/hooks/useAction';
import { useCalendar } from '@/hooks/useCalendar';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useRemoteData } from '@/hooks/useRemoteData';
import { strings, t } from '@/i18n';
import type { Poll, PollAnswer } from '@/models/types';
import * as api from '@/services/api';
import { requestSync } from '@/offline/syncEngine';
import { useUserId } from '@/stores/authStore';
import { spacing } from '@/theme/tokens';
import { formatDateTime, formatTime } from '@/utils/dates';

const ANSWERS: PollAnswer[] = ['yes', 'maybe', 'no'];

export default function PollsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const calendar = useCalendar(id);
  const userId = useUserId();
  const display = useDisplaySettings();
  const { toast } = useFeedback();
  const { run } = useAction();
  const focused = useScreenFocus();
  const calendarRevision = useDataStore((state) =>
    Object.values(state.events)
      .filter((event) => event.calendar_id === id)
      .map((event) => event.id + ':' + event.version)
      .sort()
      .join(','),
  );
  const { data, error, reload, refresh, refreshing } = useRemoteData(
    () => (focused ? api.listPolls(id) : Promise.resolve([])),
    [id, focused, calendarRevision],
    [],
  );
  const [closing, setClosing] = useState<Poll | null>(null);

  const vote = async (optionId: string, answer: PollAnswer) => {
    if ((await run(() => api.votePoll(optionId, answer))).ok) void reload();
  };

  const close = async (poll: Poll, optionId: string | null) => {
    setClosing(null);
    const result = await run(() => api.closePoll(poll.id, optionId, !!optionId));
    if (result.ok) {
      toast(optionId ? t('polls.scheduled') : t('polls.closed'));
      requestSync({ pull: true });
      void reload();
    }
  };

  const when = (o: Poll['options'][number]) =>
    `${formatDateTime(new Date(o.starts_at), display.timezone, display.dateFormat, display.timeFormat)} a ${formatTime(new Date(o.ends_at), display.timezone, display.timeFormat)}`;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: `${t('polls.title')}${calendar ? ` · ${calendar.name}` : ''}` }} />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : null}
      {!error && !data?.length ? <EmptyState art="orbit" title={t('polls.empty')} /> : null}
      {data?.map((poll) => {
        const mine = poll.created_by === userId;
        const open = poll.status === 'open';
        return (
          <Card key={poll.id} style={styles.gap}>
            <View style={styles.row}>
              <AppText variant="heading" style={styles.flex}>
                {poll.title}
              </AppText>
              <Badge label={strings.polls.status[poll.status]} tone={open ? 'primary' : 'neutral'} />
            </View>
            <AppText variant="caption" tone="muted">
              {t('polls.by', { name: poll.created_by_name })}
            </AppText>
            {poll.status === 'scheduled' && (
              <AppText variant="label">
                {!poll.meeting
                  ? 'Reunião indisponível'
                  : poll.meeting.status === 'cancelled'
                    ? 'Reunião cancelada'
                    : poll.meeting.all_day
                      ? 'Reunião de dia inteiro · ' + poll.meeting.start_date
                      : 'Horário atual · ' +
                        formatDateTime(
                          new Date(poll.meeting.starts_at),
                          display.timezone,
                          display.dateFormat,
                          display.timeFormat,
                        ) +
                        ' até ' +
                        formatDateTime(
                          new Date(poll.meeting.ends_at),
                          display.timezone,
                          display.dateFormat,
                          display.timeFormat,
                        )}
              </AppText>
            )}
            {poll.options.map((o) => {
              const myVote = o.votes.find((v) => v.user_id === userId)?.answer;
              const yes = o.votes.filter((v) => v.answer === 'yes').length;
              const maybe = o.votes.filter((v) => v.answer === 'maybe').length;
              const chosen = poll.chosen_option_id === o.id;
              return (
                <View key={o.id} style={[styles.option, chosen && styles.chosen]}>
                  <AppText variant="label">
                    {chosen ? 'Opção votada · ' : ''}
                    {when(o)}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {t('polls.votes', { yes, maybe })}
                  </AppText>
                  {open && poll.participants.some((p) => p.user_id === userId) && (
                    <View style={styles.chips}>
                      {ANSWERS.map((a) => (
                        <Chip
                          key={a}
                          label={t(`polls.${a}`)}
                          selected={myVote === a}
                          onPress={() => void vote(o.id, a)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            {open && mine && (
              <View style={styles.row}>
                <Button title={t('polls.close')} compact onPress={() => setClosing(poll)} />
                <Button
                  title={t('polls.closeOnly')}
                  variant="ghost"
                  compact
                  onPress={() => void close(poll, null)}
                />
              </View>
            )}
          </Card>
        );
      })}
      {closing && (
        <OptionSheet<string | null>
          visible
          title={t('polls.choose')}
          value={null}
          options={closing.options.map((o) => ({
            value: o.id,
            label: when(o),
            description: t('polls.votes', {
              yes: o.votes.filter((v) => v.answer === 'yes').length,
              maybe: o.votes.filter((v) => v.answer === 'maybe').length,
            }),
          }))}
          onSelect={(v) => v && void close(closing, v)}
          onClose={() => setClosing(null)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  option: { gap: 4, paddingVertical: spacing.sm },
  chosen: { opacity: 1 },
});
