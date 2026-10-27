# Design e identidade visual (SynCK)

O app segue a identidade **SynCK** (um produto CK Group). A fonte de verdade é o pacote de marca entregue em `SynCK-identidade.zip` (guia `IDENTIDADE.md`, telas de referência e tokens). Este documento diz onde cada parte da identidade mora no código.

## Onde fica cada coisa

| O quê | Arquivo |
|---|---|
| Cores (claro e escuro), cores de agenda, cores do logo, fontes, raios e movimento | `app-mobile/src/theme/marca.ts` |
| Estilos derivados: tipografia, sombras tingidas, espaçamentos, cor de agenda no tema | `app-mobile/src/theme/tokens.ts` |
| Ícones de interface (23 do pacote + complementares no mesmo traço) | `app-mobile/src/components/Icon.tsx` |
| Decoração animada (esfera de vidro, anéis de órbita, Kairo, estrela, névoa) | `app-mobile/src/components/brand/Decor.tsx` |
| Logo (vertical, horizontal e personagem) | `app-mobile/src/components/brand/Logo.tsx` e `app-mobile/assets/brand/` |
| Abertura animada (logo, barra de progresso, "um produto CK Group") | `app-mobile/src/components/brand/BrandSplash.tsx` |
| Microinterações (toque com mola, cascata, alternadores) | `app-mobile/src/components/motion.tsx` |
| Fonte Titillium Web (licença OFL) | `app-mobile/assets/fonts/` |
| Ícone do app, ícone adaptativo e monocromático do Android, splash, ícone de notificação | `app-mobile/assets/` e `app-mobile/app.json` |
| Ícones do site (iPhone e computador) e ícone pequeno das notificações | `app-mobile/public/icons/` |

Nenhuma tela usa cor solta: tudo vem de `marca.ts` por meio de `tokens.ts` e do `useAppTheme()`. A única exceção é a marca do Google no botão "Entrar com Google", que por regra do Google usa as cores dele.

## Cores

Os nomes do pacote viram chaves do tema:

| Pacote | No código | Uso |
|---|---|---|
| `bg` | `background` | Fundo das telas |
| `surface` | `surface` | Cartões, folhas, barra de navegação, campos |
| `surfaceSunken` | `surfaceAlt` | Trilhos (seletor Mês/Semana), linhas pressionadas |
| `line` / `lineStrong` | `border` / `inputBorder` | Divisórias / borda de campos e botões contornados |
| `ink` / `inkMuted` | `text` / `textMuted` | Texto principal e secundário |
| `primary`, `onPrimary`, `primarySoft`, `primaryInk` | mesmos nomes (`onPrimary` = `primaryText`) | Botão principal, FAB, dia escolhido; pílulas e chips; links |
| `tide`, `mint`, `coral`, `bronze`, `bronzeInk`, `accentInverse` | mesmos nomes | Detalhes de marca: névoa, ponto "agora", filete e assinatura, realce do toast |
| `danger`, `success`, `warning`, `warningSoft` | mesmos nomes | Estados, sempre com ícone ou palavra |

As **8 cores de agenda** (Maré, Coral, Âmbar, Céu, Ameixa, Rosa, Oliva, Ardósia) têm versão clara e escura; o banco guarda a clara e `agendaColor()` mostra a certa para o tema. Agendas e avatares criados antes da 2.0 aparecem na cor nova mais próxima.

O teste `src/theme/__tests__/marca.test.ts` confere o contraste (4,5:1 para texto, 3:1 para bordas e cores de agenda) nos dois temas.

## Tipografia

| Estilo (`variant`) | Tamanho | Fonte |
|---|---|---|
| `display` | 30/34 | Titillium Web 700 |
| `title` | 24/30 | Titillium Web 700 |
| `heading` | 18/24 | Titillium Web 600 |
| `body` / `bodyMd` | 16/24 e 15/22 | Titillium Web 400 |
| `eventTitle` | 15/20 | Titillium Web 700 |
| `label` | 13/18 | Titillium Web 600 |
| `caption` | 12/16 | Titillium Web 400 |
| `overline` | 11/14, caixa alta | Titillium Web 700 |
| `time` | 13/16, algarismos tabulares | Titillium Web 700 |

O texto acompanha o tamanho de fonte escolhido no aparelho.

## Formas e movimento

- Raios: campos 10, cartões 14, FAB e blocos 22, topo das folhas 28, botões, chips e avatares totalmente arredondados.
- Sombras curtas tingidas de abismo no tema claro; no escuro a profundidade vem da cor da superfície.
- Toque: escala 0,975 em botões e 0,99 em linhas, mola com rigidez 520 e amortecimento 36, sem oscilação. Vibração leve no botão principal (só no celular).
- Entradas: saída suave `cubic-bezier(0.2, 0.8, 0.2, 1)`; listas em cascata de 20 ms (no máximo 5 itens).
- Pílula das abas e do seletor escorrega até o item novo; o mês desliza na horizontal ao trocar.
- Com **reduzir movimento** ligado no aparelho, escalas e deslocamentos viram um fade curto e a decoração fica parada.

## Decoração

| Objeto | Onde | Tamanho |
|---|---|---|
| Esfera de vidro com névoa girando e satélites | Onboarding | até 60% da largura |
| Anéis de órbita com satélites | Cabeçalho de Hoje e Agendas, carregamento | 28% a 36% da largura, sangrando pela borda, sem cobrir dados |
| Kairo (mascote) e símbolo Órbita | Estados vazios ("Dia livre. Que raridade.", "Ninguém na sua órbita ainda") | cerca de 40% da largura |
| Estrela de quatro pontas | "Vou" no evento | estoura em 6 partículas |
| Fitas de névoa | Abertura e boas-vindas | rodapé da tela |

Regras aplicadas por `useDecorSize()`: proporcional à largura, 15% menor abaixo de 360 dp e no máximo 420 dp em tablets e computador. Só anima com a tela em foco e o app em primeiro plano.

## Logo

- Só sobre fundo claro. No tema escuro, `Logo` coloca o logo numa placa clara com raio 22.
- Abertura: vertical a 60% da largura. Login: horizontal no topo. Onboarding: personagem. Perfil (Sobre) e menu lateral: logo, filete bronze e "um produto CK Group" em `bronzeInk`.

## Navegação

Hoje, Calendário, Agendas e Perfil. No celular, abas embaixo com a pílula `primarySoft` atrás do ícone ativo; a partir de 768 de largura, menu lateral com o logo. Os avisos ficam no sino da tela Hoje (com ponto coral quando há não lidos).

## Tamanhos de tela

As faixas ficam em `src/utils/layout.ts` (hook `useLayout()`):

| Largura | Navegação | Conteúdo |
|---|---|---|
| Menos de 768 (celular) | Abas embaixo | Uma coluna (centralizada em até 720 a partir de 600) |
| 768 a 1023 (tablet) | Menu lateral | Coluna centralizada de até 720 |
| 1024 ou mais (computador) | Menu lateral | No calendário, mês à esquerda e eventos do dia à direita |

## Acessibilidade

- Área de toque mínima de 48 (`MIN_TOUCH`).
- Botões só com ícone sempre têm rótulo para leitor de tela; decorações são ocultas para ele.
- Nenhuma informação depende só de cor: etiquetas com texto, ✓ no item escolhido e nome em cada cor de agenda.

Detalhes em [ACESSIBILIDADE.md](ACESSIBILIDADE.md). Lista de telas em [TELAS.md](TELAS.md).

## Originais SVG e Android

Os 80 arquivos em `app-mobile/assets/icons/` são os originais: 79 desenhos da interface e a marca Google nas cores oficiais. Grade de 24 unidades, traço de 1,75, extremidades arredondadas e aberturas nos contornos. Os nomes públicos ficam em `iconNames.ts`, preservando todas as chamadas das telas. Logotipos e ilustrações de marca continuam nos seus componentes próprios.

Depois de editar um SVG, rode `npm run icons:build` em `app-mobile`. O script compila os traçados em `icons.generated.json`; `Icon` usa `react-native-svg` para desenhá-los no Android e na web, sem URI remota, fonte de ícones, CSS externo ou leitura de XML em tempo de execução. `npm run icons:check` impede divergência entre os originais e o registro usado pelo APK.

A Titillium Web regular, semibold e bold é carregada de arquivos TTF locais antes de fechar a abertura. A licença OFL acompanha os arquivos.
