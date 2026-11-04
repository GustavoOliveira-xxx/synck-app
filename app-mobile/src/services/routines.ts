import type { RoutinePeriod, RoutineException } from '@/models/types';
import { supabase } from './supabase';
import { reloadAccount } from './account';

export async function saveRoutines(periods: RoutinePeriod[], expected: RoutinePeriod[]): Promise<void> {
  const { error } = await supabase.rpc('save_my_routine', { p_periods: periods, p_expected: expected });
  if (error) {
    if (error.message.includes('ROUTINE_CHANGED')) {
      await reloadAccount();
      throw new Error('Sua rotina mudou em outro aparelho. Reabra esta tela antes de salvar.');
    }
    throw new Error('Não foi possível salvar. Confira sua conexão e tente novamente.');
  }
  await reloadAccount();
}
export async function setRoutineException(
  id: string,
  date: string,
  value: RoutineException | null,
  expected: RoutinePeriod[],
): Promise<void> {
  const current = expected;
  if (!current.some((p) => p.id === id)) throw new Error('Este período não existe mais. Reabra a rotina.');
  const next = current.map((p) =>
    p.id !== id
      ? p
      : {
          ...p,
          exceptions: [
            ...(p.exceptions ?? []).filter((e) => e.original_date !== date),
            ...(value ? [value] : []),
          ],
        },
  );
  await saveRoutines(next, current);
}
