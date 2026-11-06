import { create } from 'zustand';
let expiry: ReturnType<typeof setTimeout> | undefined;
export const useNavigationLoading = create<{
  pending: boolean;
  screens: { message: string }[];
  revealed: boolean;
}>(() => ({
  pending: false,
  screens: [],
  revealed: false,
}));
export function trackScreenLoad(message: string) {
  const screen = { message };
  useNavigationLoading.setState((s) => ({
    screens: [...s.screens, screen],
    revealed: s.screens.length > 0 && s.revealed,
  }));
  return () =>
    useNavigationLoading.setState((s) => ({ screens: s.screens.filter((item) => item !== screen) }));
}
export function beginNavigation() {
  clearTimeout(expiry);
  useNavigationLoading.setState({ pending: true, revealed: false });
  expiry = setTimeout(endNavigation, 15000);
}
export function endNavigation() {
  clearTimeout(expiry);
  useNavigationLoading.setState({ pending: false });
}
