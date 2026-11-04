import { create } from 'zustand';
let expiry: ReturnType<typeof setTimeout> | undefined;
export const useNavigationLoading = create<{ pending: boolean; inline: number }>(() => ({
  pending: false,
  inline: 0,
}));
export function beginNavigation() {
  clearTimeout(expiry);
  useNavigationLoading.setState({ pending: true });
  expiry = setTimeout(endNavigation, 15000);
}
export function endNavigation() {
  clearTimeout(expiry);
  useNavigationLoading.setState({ pending: false });
}
