import { useEffect } from 'react';
import { useFeedback } from './Feedback';
import { registerRoutineConfirmation } from '@/services/routineGuard';
export function RoutineGuard() {
  const { confirm } = useFeedback();
  useEffect(() => {
    registerRoutineConfirmation(confirm);
    return () => registerRoutineConfirmation(null);
  }, [confirm]);
  return null;
}
