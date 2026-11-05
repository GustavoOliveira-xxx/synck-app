import { Stack } from 'expo-router';
import { useState } from 'react';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { SelectField } from '@/components/SelectField';
import { ContextField, type PersonalContext } from '@/components/ContextField';
import { useFeedback } from '@/components/Feedback';
import { useItems } from '@/hooks/useItems';
import { useEventsMap } from '@/hooks/useEventsView';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';
import { useSyncStore } from '@/stores/syncStore';
import { reloadAccount } from '@/services/account';
import { router } from '@/services/router';
import { ROUTINE_KINDS } from '@/utils/routine';

export default function ContextsScreen() {
  const { tasks, notes, habits } = useItems();
  const events = useEventsMap();
  const account = useAuthStore((s) => s.account);
  const outbox = useSyncStore((s) => s.outbox);
  const contexts: Record<string, string> = { ...account?.contexts };
  for (const o of outbox)
    if (o.status !== 'failed' && typeof o.payload.personal_context === 'string')
      contexts[o.entity + ':' + o.entityId] = o.payload.personal_context;
  const [kind, setKind] = useState<PersonalContext | null>('work');
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useFeedback();
  const rows = [
    ...Object.values(events)
      .filter((e) => !e.is_masked && !e.deleted_at)
      .map((e) => ({
        key: 'event:' + e.id,
        title: e.title ?? 'Evento',
        type: 'Evento',
        open: () => router.push({ pathname: '/event/[id]', params: { id: e.id } }),
      })),
    ...Object.values(tasks)
      .filter((t) => !t.deleted_at)
      .map((t) => ({
        key: 'task:' + t.id,
        title: t.title,
        type: t.item_type === 'reminder' ? 'Lembrete' : 'Tarefa',
        open: () => router.push({ pathname: '/task/[id]', params: { id: t.id } }),
      })),
    ...Object.values(notes)
      .filter((n) => !n.deleted_at)
      .map((n) => ({
        key: 'note:' + n.id,
        title: n.title ?? n.body.slice(0, 50),
        type: 'Anotação',
        open: () => router.push({ pathname: '/notes/[id]', params: { id: n.id } }),
      })),
    ...Object.values(habits)
      .filter((h) => !h.deleted_at)
      .map((h) => ({
        key: 'habit:' + h.id,
        title: h.title,
        type: 'Hábito',
        open: () => router.push({ pathname: '/habits/[id]', params: { id: h.id } }),
      })),
  ].sort((a, b) => a.title.localeCompare(b.title));
  const visible = rows.filter((r) => (contexts[r.key] ?? null) === kind);
  const assign = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const [entity, id] = selected.split(':');
      const { error } = await supabase.rpc('set_my_item_context', {
        p_entity: entity,
        p_item: id,
        p_kind: kind,
      });
      if (error) throw error;
      await reloadAccount();
      setSelected('');
      toast('Contexto atualizado.');
    } catch {
      toast('Confira a conexão e o acesso ao item.', 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Meus contextos' }} />
      <ContextField value={kind} onChange={setKind} />
      <SelectField
        label="Classificar um item"
        searchable
        value={selected}
        onChange={setSelected}
        options={[
          { value: '', label: 'Escolher item' },
          ...rows
            .filter((r) => (contexts[r.key] ?? null) !== kind)
            .map((r) => ({ value: r.key, label: r.title, description: r.type })),
        ]}
      />
      {!!selected && (
        <Button
          title={kind ? 'Mover para ' + ROUTINE_KINDS[kind] : 'Remover contexto'}
          loading={saving}
          onPress={assign}
        />
      )}
      {account?.preferences.routine_periods
        ?.filter((p) => p.enabled && p.kind === kind)
        .map((p) => (
          <Button
            key={p.id}
            title={p.title + ' · ' + p.start + '–' + p.end}
            variant="ghost"
            onPress={() => router.push('/settings/routine')}
          />
        ))}
      {visible.map((r) => (
        <Button key={r.key} title={r.type + ' · ' + r.title} variant="ghost" onPress={r.open} />
      ))}
      {visible.length === 0 && <AppText tone="muted">Nenhum item neste contexto.</AppText>}
    </Screen>
  );
}
