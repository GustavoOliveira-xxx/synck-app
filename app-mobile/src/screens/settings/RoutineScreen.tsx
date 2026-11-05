import { routineBlocks } from '@/utils/routine';
import { todayKey, addDaysToKey } from '@/utils/dates';
import { timezoneOptions } from '@/utils/timezones';
import { Stack } from 'expo-router';
import { router } from '@/services/router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DateTimeField } from '@/components/DateTimeField';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { strings } from '@/i18n';
import { newId } from '@/offline/storage';
import { saveRoutines } from '@/services/routines';
import { goBack } from '@/services/navigation';
import { useAuthStore } from '@/stores/authStore';
import { spacing } from '@/theme/tokens';
import { ROUTINE_KINDS, validRoutine, type RoutinePeriod } from '@/utils/routine';

export default function RoutineScreen() {
  const saved = useAuthStore((s) => s.account?.preferences.routine_periods);
  const [base, setBase] = useState(() => saved ?? []);
  const [periods, setPeriods] = useState<RoutinePeriod[]>(base);
  // Atualiza uma tela intacta ao voltar de uma exceção salva, sem apagar edições locais.
  if (
    JSON.stringify(base) === JSON.stringify(periods) &&
    JSON.stringify(saved ?? []) !== JSON.stringify(base)
  ) {
    setBase(saved ?? []);
    setPeriods(saved ?? []);
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const display = useDisplaySettings();
  const { toast, confirm } = useFeedback();
  const { allowLeave } = useUnsavedChanges(JSON.stringify(base) !== JSON.stringify(periods) && !saving);
  const change = (id: string, patch: Partial<RoutinePeriod>) =>
    setPeriods((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const add = (kind: RoutinePeriod['kind']) => {
    setPeriods((list) => [
      ...list,
      {
        id: newId(),
        title: ROUTINE_KINDS[kind],
        kind,
        days: kind === 'sleep' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5],
        start: kind === 'sleep' ? '23:00' : kind === 'meal' ? '12:00' : '08:00',
        end: kind === 'sleep' ? '07:00' : kind === 'meal' ? '13:00' : '12:00',
        timezone: display.timezone,
        enabled: true,
      },
    ]);
  };
  const save = async () => {
    if (periods.some((p) => !validRoutine(p))) {
      setError(
        'Confira o nome, os dias e os horários de cada período. Início e fim precisam ser diferentes.',
      );
      return;
    }
    const today = todayKey(display.timezone);
    const blocks = routineBlocks(
      periods,
      Array.from({ length: 8 }, (_, i) => addDaysToKey(today, i)),
    );
    const pair = blocks.find((block, i) =>
      blocks
        .slice(i + 1)
        .some(
          (other) =>
            other.period.id !== block.period.id && other.start < block.end && other.end > block.start,
        ),
    );
    if (
      pair &&
      !(await confirm({
        title: 'Períodos de rotina coincidem',
        message:
          'Há uma sobreposição com ' + pair.period.title + ' perto desta semana. Manter os dois períodos?',
        confirmLabel: 'Manter os dois',
        cancelLabel: 'Rever horários',
      }))
    )
      return;
    setSaving(true);
    try {
      await saveRoutines(
        periods.map((p) => ({ ...p, title: p.title.trim() })),
        base,
      );
      toast('Rotina salva. Seus horários livres já foram atualizados.');
      allowLeave();
      goBack();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível salvar a rotina.', 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen footer={<Button title="Salvar rotina" onPress={save} loading={saving} testID="routine-save" />}>
      <Stack.Screen options={{ title: 'Minha rotina' }} />
      <AppText variant="heading">Um dia que respeita seu ritmo</AppText>
      <AppText tone="muted">
        Reserve os períodos em que você costuma estar ocupado. Eles aparecem como blocos fixos na agenda e
        protegem seus horários. Para um dia diferente, toque no bloco e escolha liberar ou reagendar só aquela
        ocorrência.
      </AppText>
      <AppText variant="small" tone="muted">
        Sua rotina é privada. Alterar esta tela muda o padrão semanal; as exceções por dia são preservadas.
        Compromissos já existentes não são movidos nem apagados.
      </AppText>
      {periods.map((p, index) => (
        <Card key={p.id}>
          <AppText variant="label">Período {index + 1}</AppText>
          <SelectField<RoutinePeriod['kind']>
            label="Tipo de rotina"
            value={p.kind}
            options={Object.entries(ROUTINE_KINDS).map(([value, label]) => ({
              value: value as RoutinePeriod['kind'],
              label,
            }))}
            onChange={(kind) => change(p.id, { kind })}
          />
          <TextField
            label="Nome do período"
            value={p.title}
            maxLength={60}
            onChangeText={(title) => change(p.id, { title })}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <Chip
                key={day}
                label={strings.weekdays.short[day]}
                accessibilityLabel={`${p.title}: ${strings.weekdays.long[day]}`}
                selected={p.days.includes(day)}
                onPress={() =>
                  change(p.id, {
                    days: p.days.includes(day) ? p.days.filter((d) => d !== day) : [...p.days, day],
                  })
                }
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <DateTimeField
              mode="time"
              label="Das"
              value={p.start}
              timeFormat={display.timeFormat}
              onChange={(start) => change(p.id, { start })}
            />
            <DateTimeField
              mode="time"
              label="Até"
              value={p.end}
              timeFormat={display.timeFormat}
              onChange={(end) => change(p.id, { end })}
            />
          </View>
          {p.end < p.start && (
            <AppText variant="small" tone="muted">
              Termina no dia seguinte. Selecione os dias em que este período começa.
            </AppText>
          )}
          <SelectField
            label="Fuso do período"
            value={p.timezone}
            options={timezoneOptions(p.timezone)}
            searchable
            onChange={(timezone) => change(p.id, { timezone })}
          />
          <SwitchRow
            label="Considerar nos horários livres"
            value={p.enabled}
            onChange={(enabled) => change(p.id, { enabled })}
          />
          {(p.exceptions ?? []).length > 0 && (
            <View>
              <AppText variant="label">Exceções por dia</AppText>
              {(p.exceptions ?? [])
                .slice()
                .sort((a, b) => b.original_date.localeCompare(a.original_date))
                .map((e) => (
                  <Button
                    key={e.original_date}
                    title={e.original_date + (e.action === 'skip' ? ' · liberado' : ' · reagendado')}
                    variant="ghost"
                    compact
                    onPress={() =>
                      router.push({ pathname: '/routine/day', params: { id: p.id, date: e.original_date } })
                    }
                  />
                ))}
            </View>
          )}
          <Button
            title="Remover período"
            variant="ghost"
            icon="trash-outline"
            compact
            onPress={async () => {
              if (
                await confirm({
                  title: 'Remover período?',
                  message: p.title,
                  confirmLabel: 'Remover',
                  destructive: true,
                })
              )
                setPeriods((list) => list.filter((item) => item.id !== p.id));
            }}
          />
        </Card>
      ))}
      <AppText variant="label">Adicionar um período</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {Object.entries(ROUTINE_KINDS).map(([kind, label]) => (
          <Button
            key={kind}
            title={label}
            compact
            variant="tonal"
            onPress={() =>
              periods.length < 30
                ? add(kind as RoutinePeriod['kind'])
                : toast('Você pode cadastrar até 30 períodos.')
            }
          />
        ))}
      </View>
      {error ? (
        <AppText tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      <AppText variant="small" tone="muted">
        Adicione mais de um período para dividir turnos ou incluir uma pausa. Para salvar e sincronizar entre
        aparelhos, conecte-se à internet.
      </AppText>
    </Screen>
  );
}
