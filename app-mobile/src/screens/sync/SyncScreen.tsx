import { Stack } from 'expo-router';
import { router } from '@/services/router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useEventsMap } from '@/hooks/useEventsView';
import { useItems } from '@/hooks/useItems';
import { strings, t } from '@/i18n';
import type { OutboxOp } from '@/offline/outbox';
import { discardOperation, retryOperation, syncNow } from '@/offline/syncEngine';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { formatDateTime } from '@/utils/dates';
import { toFriendlyError } from '@/utils/errors';

const STATUS: Record<
  OutboxOp['status'],
  { label: string; tone: 'warning' | 'danger' | 'primary' | 'neutral' }
> = {
  pending: { label: t('sync.waiting'), tone: 'neutral' },
  syncing: { label: t('sync.sending'), tone: 'primary' },
  failed: { label: t('sync.failed'), tone: 'danger' },
  conflict: { label: t('sync.conflict'), tone: 'warning' },
};

/** Estado da sincronização e fila de alterações deste aparelho. */
export default function SyncScreen() {
  const { colors } = useAppTheme();
  const display = useDisplaySettings();
  const { confirm } = useFeedback();
  const sync = useSyncStore();
  const events = useEventsMap();
  const items = useItems();

  const discard = async (op: OutboxOp) => {
    const ok = await confirm({
      title: t('sync.discardTitle'),
      message: t('sync.discardMessage'),
      destructive: true,
      confirmLabel: t('sync.discard'),
    });
    if (ok) await discardOperation(op.id);
  };

  const statusLine = !sync.online
    ? t('sync.offline')
    : sync.syncing
      ? t('sync.syncing')
      : sync.outbox.length
        ? t('sync.pending', { n: sync.outbox.length })
        : t('sync.synced');

  return (
    <Screen refreshing={sync.syncing} onRefresh={() => void syncNow()}>
      <Stack.Screen options={{ title: t('sync.title') }} />
      <Card>
        <View style={styles.row}>
          <Icon
            name={
              !sync.online
                ? 'cloud-offline-outline'
                : sync.outbox.length
                  ? 'cloud-upload-outline'
                  : 'cloud-done-outline'
            }
            size={32}
            color={!sync.online ? colors.warning : sync.outbox.length ? colors.primary : colors.success}
          />
          <View style={styles.flex}>
            <AppText variant="heading" accessibilityLiveRegion="polite">
              {statusLine}
            </AppText>
            <AppText variant="small" tone="muted">
              {sync.lastSyncAt
                ? t('sync.lastSync', {
                    date: formatDateTime(
                      new Date(sync.lastSyncAt),
                      display.timezone,
                      display.dateFormat,
                      display.timeFormat,
                    ),
                  })
                : t('sync.never')}
            </AppText>
          </View>
        </View>
        {sync.authRequired ? <AppText tone="danger">{t('sync.authRequired')}</AppText> : null}
        {sync.lastError ? <AppText tone="danger">{toFriendlyError(sync.lastError).message}</AppText> : null}
        <Button
          title={t('sync.syncNow')}
          icon="sync"
          onPress={() => void syncNow()}
          loading={sync.syncing}
          disabled={!sync.online}
        />
      </Card>

      <SectionHeader title={t('sync.queue')} />
      {sync.outbox.length === 0 ? (
        <AppText tone="muted">{t('sync.queueEmpty')}</AppText>
      ) : (
        sync.outbox.map((op) => {
          const event = events[op.entityId];
          const item =
            op.entity === 'task'
              ? items.tasks[op.entityId]
              : op.entity === 'note'
                ? items.notes[op.entityId]
                : undefined;
          const title =
            (op.payload.title as string | undefined) ??
            (op.payload.name as string | undefined) ??
            (op.entity === 'event' ? event?.title : item?.title) ??
            (op.conflict?.server.title as string | undefined) ??
            '';
          const kind =
            op.entity === 'event' || !op.entity
              ? strings.sync.kinds[op.kind]
              : `${strings.sync.entities[op.entity]}: ${strings.sync.kinds[op.kind].replace(/ evento$/, '').toLowerCase()}`;
          return (
            <Card key={op.id}>
              <View style={styles.row}>
                <AppText variant="label" style={styles.flex}>
                  {kind}
                  {title ? ` · ${title}` : ''}
                </AppText>
                <Badge label={STATUS[op.status].label} tone={STATUS[op.status].tone} />
              </View>
              <AppText variant="small" tone="muted">
                {formatDateTime(
                  new Date(op.createdAt),
                  display.timezone,
                  display.dateFormat,
                  display.timeFormat,
                )}
                {op.attempts ? ` · ${t('sync.attempts', { n: op.attempts })}` : ''}
              </AppText>
              {op.lastError ? (
                <AppText variant="small" tone="danger">
                  {toFriendlyError(op.lastError).message}
                </AppText>
              ) : null}
              <View style={styles.actions}>
                {op.status === 'conflict' && (
                  <Button
                    title={t('sync.resolve')}
                    compact
                    onPress={() => router.push({ pathname: '/sync/[opId]', params: { opId: op.id } })}
                  />
                )}
                {op.status === 'failed' && (
                  <Button
                    title={t('sync.retry')}
                    compact
                    variant="secondary"
                    onPress={() => retryOperation(op.id)}
                  />
                )}
                {op.status !== 'syncing' && (
                  <Button title={t('sync.discard')} compact variant="ghost" onPress={() => discard(op)} />
                )}
              </View>
            </Card>
          );
        })
      )}

      <SectionHeader title={t('sync.metrics')} />
      <Card>
        <AppText>
          {t('sync.metricSent')}: {sync.metrics.sent}
        </AppText>
        <AppText>
          {t('sync.metricFailed')}: {sync.metrics.failed}
        </AppText>
        <AppText>
          {t('sync.metricConflicts')}: {sync.metrics.conflicts}
        </AppText>
        <AppText>
          {t('sync.metricDuration')}:{' '}
          {sync.metrics.lastDurationMs === null ? '-' : `${sync.metrics.lastDurationMs} ms`}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
