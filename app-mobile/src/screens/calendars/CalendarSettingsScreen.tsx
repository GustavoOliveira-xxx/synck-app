import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectField } from '@/components/SelectField';
import { EmptyState } from '@/components/StateViews';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useCalendar } from '@/hooks/useCalendar';
import { strings, t } from '@/i18n';
import type { Calendar, ConflictPolicy, Role } from '@/models/types';
import { syncNow } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { goBack } from '@/services/navigation';
import { saveJsonFile } from '@/services/share';
import { useDataStore } from '@/stores/dataStore';
import { spacing } from '@/theme/tokens';
import { ASSIGNABLE_ROLES, isOwner } from '@/utils/permissions';
import { hasErrors } from '@/validation/auth';
import { validateCalendar } from '@/validation/calendar';

import { CalendarFormFields, type CalendarFormValues } from './CalendarFormFields';

function SettingsForm({ calendar }: { calendar: Calendar }) {
  const { confirm, toast } = useFeedback();
  const { run, busy } = useAction();
  const owner = isOwner(calendar.my_role);
  const [basic, setBasic] = useState<CalendarFormValues>({
    name: calendar.name,
    description: calendar.description ?? '',
    color: calendar.color,
    kind: calendar.kind,
    default_timezone: calendar.default_timezone,
  });
  const [settings, setSettings] = useState({
    conflict_policy: calendar.conflict_policy,
    notify_members_on_changes: calendar.notify_members_on_changes,
    default_member_role: calendar.default_member_role,
    admins_can_invite: calendar.admins_can_invite,
    members_can_invite: calendar.members_can_invite,
    editors_can_edit_all: calendar.editors_can_edit_all,
    allow_private_events: calendar.allow_private_events,
  });
  const [errors, setErrors] = useState<Partial<Record<'name' | 'description' | 'color', string>>>({});
  const [copyName, setCopyName] = useState(t('calendars.copyName', { name: calendar.name }));
  const [copyEvents, setCopyEvents] = useState(true);
  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));
  const writable = calendar.status === 'active';

  const save = async () => {
    const v = validateCalendar(basic);
    setErrors(v);
    if (hasErrors(v)) return;
    const ownerOnly = owner
      ? {
          default_member_role: settings.default_member_role,
          admins_can_invite: settings.admins_can_invite,
          members_can_invite: settings.members_can_invite,
          editors_can_edit_all: settings.editors_can_edit_all,
          allow_private_events: settings.allow_private_events,
        }
      : {};
    const result = await run(
      () =>
        api.updateCalendar(calendar.id, {
          ...basic,
          name: basic.name.trim(),
          description: basic.description.trim() || null,
          conflict_policy: settings.conflict_policy,
          notify_members_on_changes: settings.notify_members_on_changes,
          ...ownerOnly,
        }),
      { success: t('common.saved') },
    );
    if (!result.ok) return;
    await syncNow();
    // Salvou: volta para a agenda, como nos outros formulários.
    goBack();
  };

  const stateAction = async (action: 'archive' | 'unarchive' | 'trash') => {
    const messages = {
      archive: [t('calendars.archive'), t('calendars.archiveMessage')],
      unarchive: [t('calendars.unarchive'), ''],
      trash: [t('calendars.trashAction'), t('calendars.trashMessage')],
    } as const;
    const ok = await confirm({
      title: messages[action][0],
      message: messages[action][1] || undefined,
      destructive: action !== 'unarchive',
      confirmLabel: messages[action][0],
    });
    if (!ok) return;
    const result = await run(() => api.setCalendarState(calendar.id, action), { success: t('common.saved') });
    if (result.ok) {
      await syncNow();
      if (action === 'trash') router.navigate('/calendars');
    }
  };

  const duplicate = async () => {
    const result = await run(() => api.duplicateCalendar(calendar.id, copyName.trim(), copyEvents), {
      success: t('calendars.duplicateDone'),
    });
    if (result.ok) {
      await syncNow();
      router.replace({ pathname: '/calendar/[id]', params: { id: result.value } });
    }
  };

  const exportEvents = async () => {
    const events = Object.values(useDataStore.getState().events).filter((e) => e.calendar_id === calendar.id);
    const saved = await saveJsonFile(`${calendar.name}.json`, { calendar: basic, events });
    if (saved === 'copied') toast(t('common.copiedToShare'));
  };

  return (
    <Screen footer={writable ? <Button title={t('common.save')} onPress={save} loading={busy} /> : undefined}>
      <Stack.Screen options={{ title: t('calendars.settings') }} />
      <CalendarFormFields values={basic} onChange={setBasic} errors={errors} disabled={!writable} />

      <SectionHeader title={t('calendars.eventSettings')} />
      <Card>
        <SelectField<ConflictPolicy>
          label={t('calendars.conflictPolicy')}
          value={settings.conflict_policy}
          onChange={(v) => set('conflict_policy', v)}
          options={(['warn', 'block', 'ignore'] as const).map((v) => ({
            value: v,
            label: strings.conflictPolicy[v],
          }))}
          disabled={!writable}
        />
        <SwitchRow
          label={t('calendars.notifyMembers')}
          value={settings.notify_members_on_changes}
          onChange={(v) => set('notify_members_on_changes', v)}
          disabled={!writable}
        />
        {owner && (
          <>
            <SwitchRow
              label={t('calendars.editorsCanEditAll')}
              value={settings.editors_can_edit_all}
              onChange={(v) => set('editors_can_edit_all', v)}
              disabled={!writable}
            />
            <SwitchRow
              label={t('calendars.allowPrivate')}
              hint={t('calendars.allowPrivateHint')}
              value={settings.allow_private_events}
              onChange={(v) => set('allow_private_events', v)}
              disabled={!writable}
            />
          </>
        )}
      </Card>

      {owner && (
        <>
          <SectionHeader title={t('calendars.inviteSettings')} />
          <Card>
            <SelectField<Exclude<Role, 'owner'>>
              label={t('calendars.defaultRole')}
              value={settings.default_member_role}
              onChange={(v) => set('default_member_role', v)}
              options={ASSIGNABLE_ROLES.map((r) => ({
                value: r,
                label: strings.roles[r],
                description: strings.roleDescriptions[r],
              }))}
              disabled={!writable}
            />
            <SwitchRow
              label={t('calendars.adminsCanInvite')}
              value={settings.admins_can_invite}
              onChange={(v) => set('admins_can_invite', v)}
              disabled={!writable}
            />
            <SwitchRow
              label={t('calendars.membersCanInvite')}
              value={settings.members_can_invite}
              onChange={(v) => set('members_can_invite', v)}
              disabled={!writable}
            />
          </Card>
        </>
      )}

      <SectionHeader title={t('calendars.dangerZone')} />
      <Card>
        <TextField
          label={t('calendars.duplicate')}
          value={copyName}
          onChangeText={setCopyName}
          maxLength={80}
        />
        <SwitchRow label={t('calendars.duplicateWithEvents')} value={copyEvents} onChange={setCopyEvents} />
        <Button
          title={t('calendars.duplicate')}
          icon="copy-outline"
          variant="secondary"
          onPress={duplicate}
        />
        <Button
          title={t('calendars.exportEvents')}
          icon="share-outline"
          variant="secondary"
          onPress={exportEvents}
        />
      </Card>
      {owner && (
        <View style={{ gap: spacing.sm }}>
          {calendar.status === 'active' ? (
            <Button
              title={t('calendars.archive')}
              icon="archive-outline"
              variant="secondary"
              onPress={() => stateAction('archive')}
            />
          ) : (
            <Button
              title={t('calendars.unarchive')}
              icon="archive-outline"
              variant="secondary"
              onPress={() => stateAction('unarchive')}
            />
          )}
          <Button
            title={t('calendars.trashAction')}
            icon="trash-outline"
            variant="danger"
            onPress={() => stateAction('trash')}
          />
        </View>
      )}
    </Screen>
  );
}

export default function CalendarSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const calendar = useCalendar(id);
  if (!calendar) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('errors.notFound')} />
      </Screen>
    );
  }
  return <SettingsForm calendar={calendar} />;
}
