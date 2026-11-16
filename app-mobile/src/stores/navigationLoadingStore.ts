import { create } from 'zustand';

// Troca de tela em andamento. Enquanto dura mais que um instante, uma barra
// fina corre no topo; a tela nova nunca fica escondida atrás de um aviso.
let expiry: ReturnType<typeof setTimeout> | undefined;
export const useNavigationLoading = create<{ pending: boolean }>(() => ({ pending: false }));
export function beginNavigation() {
  clearTimeout(expiry);
  useNavigationLoading.setState({ pending: true });
  expiry = setTimeout(endNavigation, 15000);
}
export function endNavigation() {
  clearTimeout(expiry);
  useNavigationLoading.setState({ pending: false });
}
