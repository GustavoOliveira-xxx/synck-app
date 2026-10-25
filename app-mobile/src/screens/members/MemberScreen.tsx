import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { EmptyState } from '@/components/StateViews';
import { useAction } from '@/hooks/useAction';
import { useCalendar } from '@/hooks/useCalendar';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { strings, t } from '@/i18n';
import type { Role } from '@/models/types';
import { syncNow } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { goBack } from '@/services/navigation';
import { useDataStore } from '@/stores/dataStore';
import { spacing } from '@/theme/tokens';
import { formatDateTime } from '@/utils/dates';
import { assignableRolesFor, canManageMember } from '@/utils/permissions';

export default function MemberScreen() {
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId: string }>();
  const calendar = useCalendar(id);
  const member = useDataStore((s) => s.members[id]?.find((m) => m.member_id === memberId));
  const display = useDisplaySettings();
  const { confirm } = useFeedback();
  const { run, busy } = useAction();

  if (!calendar || !member) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('errors.notFound')} />
      </Screen>
    );
  }

  const manageable = canManageMember(calendar.my_role, member.role, member.is_me);
  const refreshMembers = async () => {
    const list = await api.listMembers(id);
    useDataStore.getState().set({ members: { ...useDataStore.getState().members, [id]: list } });
    await syncNow();
  };

  const changeRole = async (role: Exclude<Role, 'owner'>) => {
    if (role === member.role) return;
    const result = await run(() => api.changeMemberRole(member.member_id, role), {
      success: t('members.roleChanged'),
    });
    if (result.ok) await refreshMembers();
  };

  const remove = async () => {
    const ok = await confirm({
      title: t('members.removeTitle', { name: member.display_name }),
      message: t('members.removeMessage'),
      destructive: true,
      confirmLabel: t('members.remove'),
    });
    if (!ok) return;
    const result = await run(() => api.removeMember(member.member_id), { success: t('members.removed') });
    if (result.ok) {
      await refreshMembers();
      goBack();
    }
  };

  const transfer = async () => {
    const ok = await confirm({
      title: t('members.transferTitle', { name: member.display_name }),
      message: t('members.transferMessage'),
      confirmLabel: t('members.transfer'),
      destructive: true,
    });
    if (!ok) return;
    const result = await run(() => api.transferOwnership(id, member.user_id), {
      success: t('members.transferred'),
    });
    if (result.ok) {
      await refreshMembers();
      goBack();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: member.display_name }} />
      <Card>
        <View style={styles.row}>
          <Avatar name={member.display_name} color={member.avatar_color} size={56} />
          <View style={styles.flex}>
            <AppText variant="heading">{member.display_name}</AppText>
            <AppText tone="muted">{strings.roles[member.role]}</AppText>
          </View>
        </View>
        <AppText variant="small" tone="muted">
          {t('members.joined', {
            date: formatDateTime(
              new Date(member.joined_at),
              display.timezone,
              display.dateFormat,
              display.timeFormat,
            ),
          })}
        </AppText>
        {member.last_activity_at ? (
          <AppText variant="small" tone="muted">
            {t('members.lastActivity', {
              date: formatDateTime(
                new Date(member.last_activity_at),
                display.timezone,
                display.dateFormat,
                display.timeFormat,
              ),
            })}
          </AppText>
        ) : null}
      </Card>
      {manageable ? (
        <>
          <SelectField<Exclude<Role, 'owner'>>
            label={t('members.changeRole')}
            value={member.role as Exclude<Role, 'owner'>}
            onChange={changeRole}
            options={assignableRolesFor(calendar.my_role).map((r) => ({
              value: r,
              label: strings.roles[r],
              description: strings.roleDescriptions[r],
            }))}
          />
          <Button
            title={t('members.remove')}
            icon="person-remove-outline"
            variant="danger"
            onPress={remove}
            loading={busy}
          />
        </>
      ) : (
        <AppText tone="muted">{t('members.cannotManage')}</AppText>
      )}
      {calendar.my_role === 'owner' && !member.is_me && (
        <Button title={t('members.transfer')} icon="key-outline" variant="secondary" onPress={transfer} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
