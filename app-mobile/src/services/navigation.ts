// Voltar para a tela anterior. No navegador, uma tela aberta direto pelo
// endereço (link, recarregar a página, ícone da tela de início) não tem tela
// anterior: nesse caso vai para o destino informado, por padrão a tela Hoje.
import { router, type Href } from 'expo-router';

export function goBack(fallback: Href = '/'): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
