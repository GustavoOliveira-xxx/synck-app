import { router } from '@/services/router';
import { useState } from 'react';
import { View } from 'react-native';
import { useFreeSlots } from '@/hooks/usePlanning';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { formatTime, instantToLocal, isValidDateKey, todayKey } from '@/utils/dates';
import { startOptions } from '@/utils/freeTime';
import { spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';

export function AvailableTimes({
  day,
  minutes,
  timezone,
  excludeEventId,
  selected,
  onChoose,
}: {
  day: string;
  minutes: number;
  timezone: string;
  excludeEventId?: string;
  selected?: string;
  onChoose: (start: Date, end: Date) => void;
}) {
  const display = useDisplaySettings();
  const [expanded, setExpanded] = useState(false);
  const validDay = isValidDateKey(day);
  const { slots, loading, complete } = useFreeSlots(
    [validDay ? day : todayKey(timezone)],
    Math.max(1, minutes),
    excludeEventId,
    timezone,
  );
  const options = startOptions(slots, Math.max(1, minutes), 15, 96);
  if (!validDay || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (loading) return <AppText tone="muted">Conferindo horários…</AppText>;
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">Horários disponíveis</AppText>
      {!complete && (
        <AppText variant="small" tone="warning">
          Sugestões com os dados salvos neste aparelho. Conecte-se para conferir todos os eventos deste dia.
        </AppText>
      )}
      <AppText variant="small" tone="muted">
        {options.length
          ? `Sugestões para ${minutes} min, considerando seus eventos e sua rotina. Você também pode ajustar o horário manualmente.`
          : 'Não há um intervalo livre com essa duração neste dia. Escolha outro dia, reduza a duração ou informe um encaixe manualmente.'}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {options.slice(0, expanded ? 96 : 8).map((option) => {
          const start = new Date(option.start);
          return (
            <Chip
              key={option.start}
              label={formatTime(start, timezone, display.timeFormat)}
              selected={selected === instantToLocal(start, timezone).time}
              onPress={() => onChoose(start, new Date(option.end))}
            />
          );
        })}
      </View>
      {options.length > 8 && (
        <Button
          compact
          variant="ghost"
          title={expanded ? 'Mostrar menos horários' : 'Ver todos os horários'}
          onPress={() => setExpanded((v) => !v)}
        />
      )}
      <Button
        compact
        variant="ghost"
        title="Ajustar minha rotina"
        icon="time-outline"
        onPress={() => router.push('/settings/routine')}
      />
    </View>
  );
}
