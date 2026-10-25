import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ColorPicker } from '@/components/ColorPicker';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SelectField } from '@/components/SelectField';
import { SwitchRow } from '@/components/SwitchRow';
import { strings, t } from '@/i18n';
import type { EventStatus, EventType, Member } from '@/models/types';
import * as api from '@/services/api';
import { goBack } from '@/services/navigation';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useUiStore } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, spacing } from '@/theme/tokens';
import { DEFAULT_FILTERS, type EventFilters, type Ownership, type PeriodFilter } from '@/utils/filters';

const TYPES = Object.keys(strings.eventTypes) as EventType[];
const STATUSES = Object.keys(strings.eventStatus) as EventStatus[];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function FiltersScreen() {
  const { dark } = useAppTheme();
  const allCalendars = useDataStore((s) => s.calendars);
  const calendars = useMemo(() => allCalendars.filter((c) => !c.deleted_at), [allCalendars]);
  const cachedMembers = useDataStore((s) => s.members);
  const online = useSyncStore((s) => s.online);
  const [filters, setFilters] = useState<EventFilters>(useUiStore.getState().filters);
  const [remotePeople, setRemotePeople] = useState<Member[] | null>(null);
  const calendarIds = calendars.map((c) => c.id).join(',');
  const people = useMemo(
    () => remotePeople ?? Object.values(cachedMembers).flat(),
    [remotePeople, cachedMembers],
  );

  // Pessoas das agendas (para o filtro por participante).
  useEffect(() => {
    if (!online) return;
    let alive = true;
    Promise.all(
      calendarIds
        .split(',')
        .filter(Boolean)
        .map((id) => api.listMembers(id).catch(() => [])),
    )
      .then((lists) => alive && setRemotePeople(lists.flat()))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [calendarIds, online]);

  const peopleOptions = useMemo(() => {
    const unique = new Map(people.map((p) => [p.user_id, p]));
    return [
      { value: null as string | null, label: t('filters.anyParticipant') },
      ...[...unique.values()].map((p) => ({
        value: p.user_id as string | null,
        label: p.is_me ? t('common.you') : p.display_name,
      })),
    ];
  }, [people]);

  const set = <K extends keyof EventFilters>(key: K, value: EventFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const apply = () => {
    useUiStore.getState().setFilters(filters);
    goBack();
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button title={t('common.clear')} variant="secondary" onPress={() => setFilters(DEFAULT_FILTERS)} />
          <Button title={t('common.apply')} onPress={apply} />
        </View>
      }
    >
      <SectionHeader title={t('filters.calendars')} />
      <View style={styles.chips}>
        {calendars.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            color={agendaColor(c.color, dark)}
            selected={filters.calendarIds.includes(c.id)}
            onPress={() => set('calendarIds', toggle(filters.calendarIds, c.id))}
          />
        ))}
      </View>

      <SelectField<PeriodFilter>
        label={t('filters.period')}
        value={filters.period}
        onChange={(v) => set('period', v)}
        options={[
          { value: 'all', label: t('filters.periodAll') },
          { value: 'future', label: t('filters.periodFuture') },
          { value: 'past', label: t('filters.periodPast') },
          { value: 'next7', label: t('filters.periodNext7') },
          { value: 'next30', label: t('filters.periodNext30') },
        ]}
      />

      <SectionHeader title={t('filters.ownership')} />
      <SegmentedControl<Ownership>
        label={t('filters.ownership')}
        value={filters.ownership}
        onChange={(v) => set('ownership', v)}
        options={[
          { value: 'all', label: t('filters.ownershipAll') },
          { value: 'mine', label: t('filters.ownershipMine') },
          { value: 'shared', label: t('filters.ownershipShared') },
        ]}
      />

      <SelectField<string | null>
        label={t('filters.participant')}
        value={filters.participantId}
        onChange={(v) => set('participantId', v)}
        options={peopleOptions}
      />

      <SectionHeader title={t('filters.type')} />
      <View style={styles.chips}>
        {TYPES.map((type) => (
          <Chip
            key={type}
            label={strings.eventTypes[type]}
            selected={filters.types.includes(type)}
            onPress={() => set('types', toggle(filters.types, type))}
          />
        ))}
      </View>

      <SectionHeader title={t('filters.status')} />
      <View style={styles.chips}>
        {STATUSES.map((status) => (
          <Chip
            key={status}
            label={strings.eventStatus[status]}
            selected={filters.statuses.includes(status)}
            onPress={() => set('statuses', toggle(filters.statuses, status))}
          />
        ))}
      </View>

      <ColorPicker
        label={t('filters.color')}
        value={filters.color}
        onChange={(v) => set('color', v)}
        allowNone
        noneLabel={t('filters.anyColor')}
      />

      <SwitchRow
        label={t('filters.showCancelled')}
        value={filters.showCancelled}
        onChange={(v) => set('showCancelled', v)}
      />
      <SwitchRow
        label={t('filters.privateOnly')}
        value={filters.privateOnly}
        onChange={(v) => set('privateOnly', v)}
      />
      <SwitchRow
        label={t('filters.recurringOnly')}
        value={filters.recurringOnly}
        onChange={(v) => set('recurringOnly', v)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
});
