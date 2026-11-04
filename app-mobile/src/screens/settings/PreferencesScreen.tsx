import { Stack } from 'expo-router';
import { router } from '@/services/router';

import { Button } from '@/components/Button';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectField } from '@/components/SelectField';
import { SwitchRow } from '@/components/SwitchRow';
import { useAction } from '@/hooks/useAction';
import { savePreferences } from '@/services/account';
import { getDeviceTimezone } from '@/hooks/useDeviceTimezone';
import { t } from '@/i18n';
import type { DateFormat, TimeFormat, UserPreferences } from '@/models/types';
import { useAuthStore } from '@/stores/authStore';
import { formatDateKey } from '@/utils/dates';
import { timezoneOptions } from '@/utils/timezones';

const HOURS = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
);

export default function PreferencesScreen() {
  const prefs = useAuthStore((s) => s.account?.preferences);
  const { run } = useAction();
  const deviceTz = getDeviceTimezone();
  if (!prefs) return null;

  const save = (changes: Partial<UserPreferences>) =>
    run(() => savePreferences(changes), { success: t('common.saved') });

  return (
    <Screen>
      <Stack.Screen options={{ title: t('preferences.title') }} />
      <Card>
        <SwitchRow
          label={t('preferences.useDeviceTimezone')}
          hint={t('preferences.deviceTimezone', { tz: deviceTz })}
          value={prefs.use_device_timezone}
          onChange={(use_device_timezone) =>
            save({ use_device_timezone, timezone: use_device_timezone ? deviceTz : prefs.timezone })
          }
        />
        {!prefs.use_device_timezone && (
          <SelectField<string>
            label={t('preferences.timezone')}
            value={prefs.timezone}
            onChange={(timezone) => save({ timezone })}
            options={timezoneOptions(deviceTz)}
            searchable
            searchPlaceholder={t('preferences.searchTimezone')}
          />
        )}
      </Card>
      <Card>
        <SelectField<DateFormat>
          label={t('preferences.dateFormat')}
          value={prefs.date_format}
          onChange={(date_format) => save({ date_format })}
          options={(['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'] as const).map((f) => ({
            value: f,
            label: formatDateKey('2026-12-25', f),
          }))}
        />
        <SelectField<TimeFormat>
          label={t('preferences.timeFormat')}
          value={prefs.time_format}
          onChange={(time_format) => save({ time_format })}
          options={[
            { value: '24h', label: t('preferences.time24') },
            { value: '12h', label: t('preferences.time12') },
          ]}
        />
        <SelectField<0 | 1>
          label={t('preferences.weekStart')}
          value={prefs.week_starts_on}
          onChange={(week_starts_on) => save({ week_starts_on })}
          options={[
            { value: 0, label: t('preferences.weekStartSunday') },
            { value: 1, label: t('preferences.weekStartMonday') },
          ]}
        />
      </Card>
      <SectionHeader title={t('preferences.planning')} />
      <Button
        title="Minha rotina"
        variant="secondary"
        icon="time-outline"
        onPress={() => router.push('/settings/routine')}
      />
      <Card>
        <SwitchRow
          label={t('preferences.dailyCheckin')}
          hint={t('preferences.dailyCheckinHint')}
          value={prefs.daily_checkin ?? true}
          onChange={(daily_checkin) => save({ daily_checkin })}
        />
        <SelectField<string>
          label={t('preferences.dayStart')}
          value={(prefs.day_start ?? '08:00').slice(0, 5)}
          onChange={(day_start) => save({ day_start })}
          options={HOURS.filter((h) => h < (prefs.day_end ?? '22:00').slice(0, 5)).map((h) => ({
            value: h,
            label: h,
          }))}
        />
        <SelectField<string>
          label={t('preferences.dayEnd')}
          value={(prefs.day_end ?? '22:00').slice(0, 5)}
          onChange={(day_end) => save({ day_end })}
          options={HOURS.filter((h) => h > (prefs.day_start ?? '08:00').slice(0, 5)).map((h) => ({
            value: h,
            label: h,
          }))}
        />
        <AppText variant="small" tone="muted">
          {t('preferences.dayWindowHint')}
        </AppText>
        <SwitchRow
          label={t('preferences.shareAvailability')}
          hint={t('preferences.shareAvailabilityHint')}
          value={prefs.share_availability ?? false}
          onChange={(share_availability) => save({ share_availability })}
        />
      </Card>
      <AppText variant="small" tone="muted">
        {t('common.requiresInternet')}
      </AppText>
    </Screen>
  );
}
