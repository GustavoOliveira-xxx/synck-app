import { useEffect, useState } from 'react';
export function useDelayedLoading(active: boolean, delay = 250) {
  const [state, setState] = useState({ active, visible: false });
  if (state.active !== active) setState({ active, visible: false });
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setState({ active: true, visible: true }), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);
  return active && state.active && state.visible;
}
