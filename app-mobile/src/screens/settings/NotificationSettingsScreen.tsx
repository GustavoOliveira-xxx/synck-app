import * as Notifications from 'expo-notifications';
import { refreshReminders } from '@/services/session';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, AppState, Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { DateTimeField } from '@/components/DateTimeField';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectField } from '@/components/SelectField';
import { SwitchRow } from '@/components/SwitchRow';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import type { NotificationPreferences } from '@/models/types';
import { saveNotificationPreferences } from '@/services/account';
import {
  getPermissionStatus,
  notificationsSupported,
  requestPermission,
} from '@/services/localNotifications';
import { disableWebPush, enableWebPush, getWebPushState, type WebPushState } from '@/services/webPush';
import { useAuthStore } from '@/stores/authStore';
import { spacing } from '@/theme/tokens';
import { toFriendlyError } from '@/utils/errors';
import { REMINDER_PRESETS, reminderLabel } from '@/utils/reminders';

/** Navegador (iPhone e computador): ativar as notificações deste navegador. */
function WebPushCard() {
  const [state, setState] = useState<WebPushState | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useFeedback();
  useEffect(() => {
    void getWebPushState()
      .then(setState)
      .catch(() => setState('unavailable'));
  }, []);
  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      const next = on ? await enableWebPush() : await disableWebPush();
      setState(next);
      if (next === 'on') toast(t('notificationSettings.webPushEnabled'));
    } catch (error) {
      toast(toFriendlyError(error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const message =
    state === 'unsupported'
      ? t('notificationSettings.webPushUnsupported')
      : state === 'blocked'
        ? t('notificationSettings.webPushBlocked')
        : state === 'unavailable'
          ? t('notificationSettings.webPushUnavailable')
          : t('notificationSettings.webPushHint');
  return (
    <Card>
      <SwitchRow
        label={t('notificationSettings.webPush')}
        hint={state === 'on' ? t('notificationSettings.webPushOn') : t('notificationSettings.webPushOff')}
        value={state === 'on'}
        disabled={busy || state === null || state === 'unsupported'}
        onChange={(on) => void toggle(on)}
      />
      <AppText variant="small" tone={state === 'blocked' || state === 'unsupported' ? 'warning' : 'muted'}>
        {message}
      </AppText>
    </Card>
  );
}

export default function NotificationSettingsScreen() {
  const prefs = useAuthStore((s) => s.account?.notification_preferences);
  const { run } = useAction();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  const [exact, setExact] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => {
      void getPermissionStatus().then(setPermission);
      if (Platform.OS === 'android')
        void Notifications.getExactAlarmPermissionsAsync()
          .then((r) => setExact(r.granted))
          .catch(() => setExact(null));
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, []);

  if (!prefs) return null;
  const save = (changes: Partial<NotificationPreferences>) => run(() => saveNotificationPreferences(changes));
  const quiet = !!prefs.quiet_hours_start && !!prefs.quiet_hours_end;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('notificationSettings.title') }} />
      {!notificationsSupported && <WebPushCard />}
      {notificationsSupported && (
        <Card>
          <AppText variant="label">{t('notificationSettings.systemPermission')}</AppText>
          <AppText tone={permission === 'granted' ? 'success' : 'warning'}>
            {permission === 'granted'
              ? t('notificationSettings.permissionGranted')
              : t('notificationSettings.permissionDenied')}
          </AppText>
          {exact === false && permission === 'granted' && (
            <Button
              variant="secondary"
              title="Permitir alarmes no horário exato"
              onPress={() =>
                run(async () => {
                  const p = await Notifications.requestExactAlarmPermissionsAsync();
                  setExact(p.granted);
                  await refreshReminders();
                })
              }
            />
          )}
          {permission !== 'granted' && (
            <View style={styles.row}>
              <Button
                title={t('notificationSettings.requestPermission')}
                compact
                onPress={async () => {
                  const ok = await requestPermission();
                  setPermission(ok ? 'granted' : 'denied');
                  if (!ok) await Linking.openSettings();
                  else await refreshReminders();
                }}
              />
            </View>
          )}
        </Card>
      )}
      <Card>
        <SwitchRow
          label={t('notificationSettings.enabled')}
          value={prefs.enabled}
          onChange={(enabled) => save({ enabled })}
        />
        <SwitchRow
          label={t('notificationSettings.reminders')}
          value={prefs.notify_reminders}
          onChange={(notify_reminders) => save({ notify_reminders })}
          disabled={!prefs.enabled}
        />
        <SwitchRow
          label={t('notificationSettings.tasks')}
          value={prefs.notify_tasks ?? true}
          onChange={(notify_tasks) => save({ notify_tasks })}
          disabled={!prefs.enabled}
        />
        <SwitchRow
          label={t('notificationSettings.invites')}
          value={prefs.notify_invites}
          onChange={(notify_invites) => save({ notify_invites })}
          disabled={!prefs.enabled}
        />
        <SwitchRow
          label={t('notificationSettings.eventChanges')}
          value={prefs.notify_event_changes}
          onChange={(notify_event_changes) => save({ notify_event_changes })}
          disabled={!prefs.enabled}
        />
        <SwitchRow
          label={t('notificationSettings.memberChanges')}
          value={prefs.notify_member_changes}
          onChange={(notify_member_changes) => save({ notify_member_changes })}
          disabled={!prefs.enabled}
        />
        <SwitchRow
          label={t('notificationSettings.comments')}
          value={prefs.notify_comments}
          onChange={(notify_comments) => save({ notify_comments })}
          disabled={!prefs.enabled}
        />
        <AppText variant="small" tone="muted">
          {t('notificationSettings.perCalendarHint')}
        </AppText>
      </Card>

      <SectionHeader title={t('reminders.title')} />
      <Card>
        <SelectField<number | null>
          label={t('notificationSettings.defaultReminder')}
          value={prefs.default_reminder_minutes}
          onChange={(default_reminder_minutes) => save({ default_reminder_minutes })}
          options={[
            { value: null, label: t('reminders.none') },
            ...REMINDER_PRESETS.map((m) => ({ value: m as number | null, label: reminderLabel(m) })),
          ]}
        />
        <SwitchRow
          label={t('notificationSettings.lockScreen')}
          hint={t('notificationSettings.lockScreenHint')}
          value={prefs.show_details_on_lock_screen}
          onChange={(show_details_on_lock_screen) => save({ show_details_on_lock_screen })}
        />
        <SwitchRow
          label={t('notificationSettings.sound')}
          value={prefs.sound}
          onChange={(sound) => save({ sound })}
        />
        <SwitchRow
          label={t('notificationSettings.vibration')}
          value={prefs.vibration}
          onChange={(vibration) => save({ vibration })}
        />
        <SwitchRow
          label={t('notificationSettings.quietHours')}
          hint={t('notificationSettings.quietHoursHint')}
          value={quiet}
          onChange={(on) =>
            save(
              on
                ? { quiet_hours_start: '22:00', quiet_hours_end: '07:00' }
                : { quiet_hours_start: null, quiet_hours_end: null },
            )
          }
        />
        {quiet && (
          <View style={styles.row}>
            <DateTimeField
              mode="time"
              label={t('notificationSettings.quietFrom')}
              value={prefs.quiet_hours_start!.slice(0, 5)}
              onChange={(v) => save({ quiet_hours_start: v })}
            />
            <DateTimeField
              mode="time"
              label={t('notificationSettings.quietTo')}
              value={prefs.quiet_hours_end!.slice(0, 5)}
              onChange={(v) => save({ quiet_hours_end: v })}
            />
          </View>
        )}
      </Card>
      <AppText variant="small" tone="muted">
        {t('notificationSettings.remoteNote')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.md } });
