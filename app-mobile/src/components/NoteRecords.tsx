import { useState } from 'react';
import { AppText } from './AppText';
import { Button } from './Button';
import { useFeedback } from './Feedback';
import { supabase } from '@/services/supabase';
import { newId } from '@/offline/storage';
import { syncNow } from '@/offline/syncEngine';
type RecordRow = {
  id: string;
  title: string | null;
  body?: string;
  excerpt?: string;
  saved_at?: string;
  calendar_id?: string | null;
};
export function NoteRecords({ id, calendar }: { id?: string; calendar?: string | null }) {
  const [rows, setRows] = useState<RecordRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useFeedback();
  const load = async () => {
    setBusy(true);
    try {
      const { data, error } = id
        ? await supabase.rpc('note_versions', { p_note: id })
        : await supabase.rpc('my_deleted_notes');
      if (error) throw error;
      setRows(
        (data as RecordRow[]).filter(
          (row) =>
            id || !calendar || (calendar === 'personal' ? !row.calendar_id : row.calendar_id === calendar),
        ),
      );
    } catch {
      toast('Confira a conexão e tente novamente.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const restore = async (row: RecordRow) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('apply_item_op', {
        p_op_id: newId(),
        p_entity: 'note',
        p_kind: 'restore',
        p_id: row.id,
        p_payload: {},
      });
      if (error || data?.status !== 'ok') throw Error();
      await syncNow();
      setRows((prev) => prev?.filter((r) => r.id !== row.id) ?? null);
      toast('Anotação restaurada.');
    } catch {
      toast('Não foi possível restaurar.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="ghost"
        title={rows ? 'Fechar' : id ? 'Histórico do texto' : 'Anotações excluídas'}
        loading={busy}
        onPress={() => (rows ? setRows(null) : void load())}
      />
      {rows?.length === 0 && (
        <AppText tone="muted">{id ? 'Nenhuma versão anterior.' : 'Nenhuma anotação excluída.'}</AppText>
      )}
      {rows?.map((row) =>
        id ? (
          <AppText key={row.id}>
            {new Date(row.saved_at!).toLocaleString('pt-BR')} · {row.title}
            {'\n'}
            {row.body}
          </AppText>
        ) : (
          <Button
            key={row.id}
            variant="tonal"
            disabled={busy}
            title={'Restaurar · ' + (row.title || row.excerpt || 'Anotação')}
            onPress={() => restore(row)}
          />
        ),
      )}
    </>
  );
}
