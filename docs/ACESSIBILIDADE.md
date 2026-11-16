# Acessibilidade

O que o app faz em acessibilidade, onde está no código, o que ficou incompleto e como testar com o celular na mão.

> Tudo o que está aqui foi conferido **lendo o código** e calculando as cores. **Nada foi testado ainda em um celular real com o TalkBack** (o leitor de tela do Android), com fonte no tamanho máximo ou com simuladores de daltonismo. O [roteiro de teste manual](#roteiro-de-teste-manual-de-acessibilidade) no fim deste arquivo existe justamente para isso.

## Como ler os status

| Status | Significado |
|---|---|
| **Atendido** | Implementado e conferido no código. Falta só a confirmação no aparelho (vale para todos os itens). |
| **Parcial** | Parte está feita, parte não. O motivo está escrito ao lado. |
| **Não atendido** | Não foi feito. O motivo está escrito ao lado. |

## Resumo

Dos 12 itens de acessibilidade:

- **Atendidos (7):** tamanho de fonte ajustável, rótulos acessíveis, não depender só de cores, mensagens compreensíveis, navegação previsível, textos alternativos para imagens e redução de animações.
- **Parciais (5):** contraste, leitor de tela, áreas de toque, foco visível e daltonismo.
- **Não atendidos (0):** nenhum item ficou totalmente sem tratamento.

Os problemas mais importantes que continuam abertos:

1. As **cores das agendas não têm nome visível na tela** (só o leitor de tela fala o nome), o que atrapalha quem tem daltonismo ao escolher ou filtrar por cor.
2. Barras e bolinhas de algumas cores de agenda ficam abaixo de 3:1 contra o cartão (a informação também aparece em texto).
3. **Nada foi validado em aparelho real** com TalkBack.

Já corrigidos durante a revisão desta documentação: texto do botão de perigo no tema escuro (era 2,28:1, agora 8,00:1), escolha automática de texto claro ou escuro sobre as cores de agenda (`readableTextOn()`), áreas de toque das bolinhas de cor, do seletor Mês/Semana/Dia/Lista e das perguntas da Ajuda (agora 48 dp), borda dos campos de formulário e do interruptor desligado (nova cor `inputBorder`, era 1,41:1 e 1,53:1, agora 3,34:1 e 3,20:1) e uso da preferência "remover animações" nos diálogos, listas de opções e no seletor de data.

## Requisitos de acessibilidade

Os caminhos de arquivo são relativos a `app-mobile/`.

| Requisito | Como está implementado | Status |
|---|---|---|
| Contraste adequado | As cores ficam em `src/theme/marca.ts`, com uma paleta clara e uma escura. Textos principais, textos secundários, botão principal, mensagens de erro, avisos e etiquetas passam de 4,5:1 nos dois temas (conferido pelo teste descrito em [Contraste](#contraste-wcag)). O componente `Badge.tsx` e o `OfflineBanner.tsx` usam pares de cor "suave + forte" que também passam. O botão de perigo usa a cor `dangerText`, própria de cada tema (`src/components/Button.tsx`). Sobre as cores de agenda, `readableTextOn()` escolhe entre texto branco e quase preto o que tiver mais contraste. | **Parcial:** barras e bolinhas de algumas cores de agenda ficam abaixo de 3:1 contra o cartão (detalhes abaixo). |
| Tamanho de fonte ajustável | Todo texto passa pelo `src/components/AppText.tsx`, que usa o `Text` padrão do React Native. Ele acompanha o tamanho de fonte escolhido nas configurações do Android, e **nenhum lugar do código desliga isso** (não existe `allowFontScaling={false}`). Para não quebrar o layout, só alguns textos em espaços pequenos têm limite (`maxFontSizeMultiplier`): iniciais do avatar (1,2x em `Avatar.tsx`), cabeçalho dos dias da semana (1,2x) e número do dia (1,3x) em `MonthGrid.tsx`, o sinal "+" de "mais eventos" (1x) e as opções do seletor de visualização (1,4x em `SegmentedControl.tsx`). Os componentes usam altura **mínima** (`minHeight`), não altura fixa, então crescem com o texto. | **Atendido** (o app não tem uma opção própria de tamanho de fonte: usa a do celular). |
| Leitor de tela | Os componentes informam papel, nome e estado ao TalkBack: `accessibilityRole` (botão, aba, caixa de seleção, opção de rádio, cabeçalho, alerta, barra de progresso), `accessibilityLabel` e `accessibilityState` (marcado, selecionado, desativado, ocupado, expandido). Títulos viram "cabeçalho" automaticamente em `AppText.tsx`. Mudanças importantes são anunciadas: mensagens rápidas (toasts) com `AccessibilityInfo.announceForAccessibility` em `Feedback.tsx`; erros de campo, faixa "sem internet", estado de erro, título do período no calendário e resultados da busca com `accessibilityLiveRegion` (`TextField.tsx`, `DateTimeField.tsx`, `OfflineBanner.tsx`, `StateViews.tsx`, `screens/calendar/CalendarScreen.tsx`, `screens/misc/SearchScreen.tsx`, `screens/sync/SyncScreen.tsx`); erro de login e cadastro com prioridade alta (`assertive`) em `screens/auth/LoginScreen.tsx` e `SignupScreen.tsx`. Diálogos e listas de opções abrem numa janela própria (`Modal`) com `accessibilityViewIsModal` (`Feedback.tsx`, `OptionSheet.tsx`). | **Parcial:** está no código, mas **nunca foi testado com o TalkBack** num aparelho. Pontos a conferir: o toast pode ser lido duas vezes (tem anúncio e região viva ao mesmo tempo); a mensagem "Muitas tentativas. Aguarde..." do login não é anunciada sozinha. |
| Rótulos acessíveis | `Button.tsx` usa o próprio texto como rótulo. `IconButton.tsx` (botão só com ícone) **exige** um rótulo: o TypeScript não deixa criar sem ele. O botão flutuante "+" (`FAB.tsx`) diz "Novo evento". Campos (`TextField.tsx`, `SelectField.tsx`, `DateTimeField.tsx`, `SwitchRow.tsx`) dizem o nome do campo e o valor atual, por exemplo "Hora de início: 14:00". Cada dia da grade mensal (`MonthGrid.tsx`) diz a data por extenso, se é hoje e quantos eventos tem. Cada linha de evento (`EventRow.tsx`) diz título, horário, agenda, local e as etiquetas (cancelado, repete, privado, aguardando envio, conflito). A aba "Avisos" diz quantos não lidos existem (`src/app/(app)/(tabs)/_layout.tsx`). O código de convite é soletrado letra por letra (`screens/invites/InviteScreen.tsx`). Os dias da semana na repetição são lidos por extenso ("segunda-feira", em `screens/events/EventFormScreen.tsx`). | **Atendido** |
| Não depender somente de cores | Toda etiqueta de estado tem **texto**, e quase todas têm ícone (`Badge.tsx`): "Cancelado", "Repete", "Privado", "Ocupado", "Restrito", "Aguardando envio", "Conflito de horário". Evento cancelado também fica riscado (`EventRow.tsx`). Opções marcadas mostram um ✓ (`Chip.tsx`, `ColorPicker.tsx`, `OptionSheet.tsx`). O dia de hoje tem anel e negrito; o dia escolhido fica preenchido (`MonthGrid.tsx`). O ícone de sincronização no topo muda de **desenho** (nuvem riscada, nuvem com seta, nuvem com ✓), não só de cor. Campo com erro mostra a mensagem escrita e borda mais grossa (`TextField.tsx`). A cor da agenda num evento é só um complemento: o nome da agenda aparece escrito. | **Atendido** |
| Áreas de toque grandes | O tamanho mínimo é a constante `MIN_TOUCH = 48` (48 dp, recomendação do Android) em `src/theme/tokens.ts`. É usada em `Button.tsx`, `IconButton.tsx` (48 x 48), `TextField.tsx`, `SelectField.tsx`, `DateTimeField.tsx`, `SwitchRow.tsx`, `OptionSheet.tsx` (52), `ListItem.tsx` (56), `EventRow.tsx` (64) e no botão "Desfazer" do toast (`Feedback.tsx`). O botão "+" tem 60 x 60. As bolinhas de cor (`ColorPicker.tsx`), as opções do seletor Mês/Semana/Dia/Lista (`SegmentedControl.tsx`) e as perguntas da Ajuda (`screens/misc/HelpScreen.tsx`) têm 48. `Chip.tsx` tem 40 de altura mais 4 de margem de toque (`hitSlop`) em cima e embaixo, chegando a 48. | **Parcial:** em telas com menos de 368 dp de largura, cada dia da grade mensal (`MonthGrid.tsx`) fica com menos de 48 dp de largura (a largura é a da tela, menos as margens, dividida por 7). A altura é 52. |
| Foco visível | O campo de texto em foco ganha borda de 2 px na cor `focus` (contraste de 8,99:1 no claro e 11,02:1 no escuro) em `TextField.tsx`. A cor escolhida ganha borda de foco e ✓ (`ColorPicker.tsx`). Com o TalkBack ligado, o próprio Android desenha um retângulo em volta do item focado. | **Parcial:** botões, linhas de lista e opções (`Pressable`) não mostram um contorno próprio quando focados por teclado físico, controle direcional ou "Acesso com interruptor"; só mudam de opacidade ao serem pressionados. |
| Mensagens compreensíveis | Todos os textos ficam em `src/i18n/pt-BR.ts`, em português do Brasil. Códigos de erro do servidor viram frases que explicam o problema e o que fazer, em `src/utils/errors.ts` (ex.: "Este convite expirou. Peça um novo para quem convidou."). Nenhum detalhe técnico aparece para a pessoa (`AppErrorBoundary.tsx`). Isso é verificado pelo teste automático `src/utils/__tests__/errors.test.ts` (5 testes). Ações destrutivas pedem confirmação explicando a consequência (ex.: "O evento sai da agenda de todos os membros."). | **Atendido** |
| Navegação previsível | Quatro abas fixas, sempre com texto e ícone: Agenda, Agendas, Avisos e Perfil (`src/app/(app)/(tabs)/_layout.tsx`). Toda tela interna tem barra de título com botão de voltar (`src/app/(app)/_layout.tsx`, `src/app/(auth)/_layout.tsx`). O botão "voltar" do Android fecha diálogos e listas de opções (`onRequestClose` em `Feedback.tsx`, `OptionSheet.tsx`). Todas as telas usam a mesma estrutura (`Screen.tsx`): margens, rolagem e faixa de "sem internet" no mesmo lugar. | **Atendido** |
| Tratamento de daltonismo | Como nenhuma informação depende só de cor (ver acima), quem não distingue cores consegue usar o app. Cada uma das 10 cores de agenda tem um nome em `CALENDAR_COLORS` (`src/theme/tokens.ts`), lido pelo leitor de tela. | **Parcial:** o nome da cor **não aparece escrito na tela** (a função `colorName()` existe em `tokens.ts`, mas nenhuma tela a usa). Quem enxerga e tem daltonismo pode confundir, por exemplo, Vermelho, Verde e Laranja ao escolher a cor de uma agenda ou ao filtrar por cor (`screens/calendar/FiltersScreen.tsx`). Não foi feito teste com simulador de daltonismo. |
| Textos alternativos para imagens | A única imagem do app é o logotipo na tela de boas-vindas, marcada como decorativa (`accessible={false}` em `screens/auth/WelcomeScreen.tsx`), com o nome do app escrito logo abaixo. Os ícones (`Icon.tsx`) ficam escondidos do leitor de tela de propósito: quem descreve a ação é o texto ao lado ou o rótulo do botão. O avatar com iniciais (`Avatar.tsx`) também fica escondido, porque o nome da pessoa aparece escrito ao lado. A versão 1 não tem envio de fotos nem anexos. | **Atendido** |
| Redução de animações, quando aplicável | Desde a 3.7.0 o app usa movimento elástico: toque que achata e volta balançando, blocos que entram quicando, troca de aba com mola, confete ao concluir tarefa, botão "+" que respira e a esfera da abertura (`components/motion.tsx`, `TabBar.tsx`, `Confetti.tsx`, `FAB.tsx`, `brand/BrandSplash.tsx`). O `src/theme/ThemeProvider.tsx` lê a preferência "remover animações" do celular (`AccessibilityInfo.isReduceMotionEnabled` e o evento `reduceMotionChanged`) e a disponibiliza como `reduceMotion` e `lite`. Com ela ligada: toques, entradas e trocas de aba viram um fade curto, sem escala nem deslocamento; confete, respiração do "+", ondas da esfera e brilho do esqueleto param; a abertura só esmaece; o diálogo (`Feedback.tsx`), a lista de opções (`OptionSheet.tsx`) e o seletor de data do iOS (`DateTimeField.tsx`) abrem sem animação. Nada pisca nem repete mais de três vezes por segundo. | **Atendido.** A transição entre telas internas segue a configuração do próprio Android. O teste de tela `interface: fonte local, SVG, toque cancelado e movimento reduzido` confere que o toque não muda de escala com a preferência ligada. |

### Itens complementares

| Item | Como está implementado | Status |
|---|---|---|
| Tema escuro | `app.json` declara `"userInterfaceStyle": "automatic"`. O `ThemeProvider.tsx` escolhe a paleta clara ou escura conforme a preferência da pessoa em **Perfil > Preferências > Tema** ("Automático (do celular)", "Claro" ou "Escuro"). Barra de status, cabeçalhos e abas também seguem o tema (`src/app/_layout.tsx` e layouts). Os componentes pegam as cores do tema (`useAppTheme()`), inclusive o texto do botão de perigo (`dangerText`). | **Atendido** (a borda fraca dos campos vale para os dois temas e está em "Contraste"). |
| Idioma | Textos em português do Brasil, com estrutura pronta para outros idiomas (`src/i18n/`). | **Atendido** |

## Contraste (WCAG)

As cores do app ficam em `app-mobile/src/theme/marca.ts`. O teste automático `src/theme/__tests__/marca.test.ts` calcula o contraste (fórmula de luminância relativa da WCAG 2.1) e falha se algum par ficar abaixo do mínimo, nos temas claro e escuro:

- **4,5:1** para texto: texto principal e secundário sobre os três fundos, texto sobre a cor principal, texto do botão de perigo, cor principal usada como texto (sobre o cartão e sobre o fundo de item selecionado), mensagens de erro, avisos e etiquetas de sucesso;
- **3:1** para a borda dos campos de formulário (critério 1.4.11).

Assim, ao trocar a identidade visual, o próprio teste aponta se algum texto ficou difícil de ler.

### Cores das agendas

As 10 cores de `CALENDAR_COLORS` aparecem como barra lateral do evento, bolinhas na grade mensal, avatar com iniciais e opções do seletor de cor. Para o ✓ do seletor e as iniciais do avatar, a função `readableTextOn()` (`src/theme/tokens.ts`) calcula o contraste com branco e com quase preto e escolhe o maior.

| Cor | Texto escolhido sobre a cor (✓ do seletor, iniciais do avatar) | Cor sobre cartão claro | Cor sobre cartão escuro |
|---|---|---|---|
| Azul `#3358D4` | branco, 6,02:1 | 6,02:1 | **2,80:1** |
| Vermelho `#E5484D` | escuro, 4,75:1 | 3,91:1 | 4,31:1 |
| Verde `#30A46C` | escuro, 5,89:1 | 3,16:1 | 5,34:1 |
| Laranja `#F76B15` | escuro, 6,25:1 | **2,97:1** | 5,68:1 |
| Roxo `#8E4EC6` | branco, 5,18:1 | 5,18:1 | 3,26:1 |
| Azul-claro `#0090FF` | escuro, 5,69:1 | 3,26:1 | 5,17:1 |
| Rosa `#D6409F` | escuro, 4,51:1 | 4,12:1 | 4,09:1 |
| Turquesa `#12A594` | escuro, 6,05:1 | 3,07:1 | 5,49:1 |
| Marrom `#AD7F58` | escuro, 5,27:1 | 3,53:1 | 4,78:1 |
| Índigo `#5B5BD6` | branco, 5,37:1 | 5,37:1 | 3,14:1 |

Como interpretar:
- O ✓ do seletor e as iniciais do avatar passam de 4,5:1 em todas as cores (o Rosa fica no limite, 4,51:1). A cor inicial da "Minha agenda" e dos avatares é o Azul `#3358D4` (6,02:1 com branco).
- Barras e bolinhas coloridas são complemento (o nome da agenda aparece escrito). Ficam abaixo de 3:1 contra o cartão o **Laranja** no tema claro (2,97:1) e o **Azul** no tema escuro (2,80:1).

Correção sugerida (ainda **não** aplicada):
- Barras e bolinhas de agenda: desenhar um contorno fino na cor do texto secundário, para que fiquem visíveis em qualquer cor e tema.

## Roteiro de teste manual de acessibilidade

Feito para qualquer pessoa, sem precisar programar. Use um celular Android com o app instalado (veja o [COMO_INSTALAR.md](../COMO_INSTALAR.md)) e, se possível, as contas de demonstração descritas no [TESTES.md](TESTES.md#preparação). Anote o resultado de cada passo na [tabela de registro](#registro-dos-resultados).

Os nomes dos menus do Android mudam um pouco de fabricante para fabricante (Samsung, Motorola, Xiaomi...). Se não achar um item, use a busca dentro do app **Configurações** do celular.

### A. Leitor de tela (TalkBack)

**Como ligar:** Configurações > Acessibilidade > TalkBack > ligar. Em muitos aparelhos, segurar as duas teclas de volume por 3 segundos também liga e desliga.

**Gestos básicos com o TalkBack ligado:**
- tocar uma vez: o celular **lê** o item (não aciona);
- tocar duas vezes em qualquer lugar: **aciona** o item que foi lido;
- deslizar um dedo para a direita ou para a esquerda: vai para o próximo item ou para o anterior;
- deslizar com dois dedos: rola a tela.

| Passo | O que fazer | Resultado esperado |
|---|---|---|
| A1 | Abra o app na tela de boas-vindas e deslize para a direita item por item. | O logotipo é pulado (ou não diz nada). Lê "SynCK" como cabeçalho (o TalkBack pode dizer "título"), o subtítulo, depois "Criar conta, botão" e "Já tenho conta, botão". |
| A2 | Entre em "Já tenho conta". Deslize pelos campos. | Lê "E-mail" e "Senha" como campos de edição. O botão de olho lê "Mostrar senha". |
| A3 | Toque duas vezes em "Entrar" com a senha errada. | O erro "E-mail ou senha incorretos." é lido **sem** você precisar procurar por ele. |
| A4 | Entre com uma conta de demonstração. Deslize pela barra de abas, embaixo. | Lê "Agenda", "Agendas", "Avisos" (com a quantidade de não lidos, se houver) e "Perfil", cada uma como aba. |
| A5 | Na aba Agenda, visão "Mês", deslize pelos dias. | Cada dia é lido por extenso, com "Hoje" no dia atual e a quantidade de eventos, por exemplo "..., 2 evento(s)". O dia escolhido é lido como "selecionado". |
| A6 | Toque duas vezes em "Próximo" (seta ao lado do nome do mês). | O nome do novo mês é anunciado. |
| A7 | Deslize até um evento na lista do dia. | Uma frase só com título, horário, agenda, local e etiquetas (ex.: "Repete", "Cancelado", "Ocupado"). |
| A8 | Encontre o botão "+" e toque duas vezes. | Lê "Novo evento, botão" e abre o formulário. |
| A9 | No formulário, deixe o título vazio e toque em "Salvar". | A mensagem "Campo obrigatório." é anunciada. |
| A10 | Ainda no formulário, vá até "Hora de início". | Lê o nome e o valor, ex.: "Hora de início: 14:00, botão". |
| A11 | Em "Repetir", escolha "Personalizar..." e percorra os dias da semana que aparecem. | Os dias são lidos por extenso ("segunda-feira") e dizem se estão marcados. |
| A12 | Em "Mais opções", vá até "Cor do evento". | Cada cor é lida pelo nome ("Azul", "Verde"...) e a escolhida é lida como "marcada". |
| A13 | Salve o evento. | A mensagem "Evento criado." é anunciada. Anote se ela foi lida **duas vezes** (problema conhecido a confirmar). |
| A14 | Abra o evento que você criou (sem repetição) e toque em "Excluir". | O diálogo "Excluir evento?" abre e o TalkBack **não sai** do diálogo ao deslizar. "Cancelar" fecha o diálogo sem excluir. |
| A15 | Ligue o modo avião. | O aviso "Sem internet. Você está vendo os dados guardados neste aparelho." é anunciado. |
| A16 | Em Agendas, abra uma agenda e vá em "Convidar pessoas" > "Gerar convite". | O código é lido letra por letra (ex.: "A B 1 2 ..."). |

### B. Fonte grande

**Como ajustar:** Configurações > Tela > Tamanho da fonte (às vezes "Tamanho e estilo da fonte"): coloque no **máximo**. Se existir "Tamanho da exibição" ou "Zoom da tela", teste também no máximo.

| Passo | O que fazer | Resultado esperado |
|---|---|---|
| B1 | Abra o app e passe pelas telas de boas-vindas, login, Agenda (Mês, Semana, Dia e Lista), formulário de evento, detalhe do evento, Agendas, Membros e Perfil. | Todo texto ficou maior. Nada aparece cortado pela metade, sobreposto ou escondido. Dá para rolar até o fim de cada tela. |
| B2 | Na visão "Mês". | Os números dos dias crescem um pouco (limite de 1,3x) e cabem nos círculos. |
| B3 | Botões e campos. | Crescem junto com o texto; o texto não fica cortado. |
| B4 | Seletor "Mês / Semana / Dia / Lista". | As quatro palavras continuam legíveis (limite de 1,4x). Anote se alguma for cortada. |

### C. Tema escuro

**Como ajustar:** no app, Perfil > Preferências > Tema > "Escuro". Depois teste também "Automático (do celular)" com o modo escuro do Android ligado (Configurações > Tela > Tema escuro).

| Passo | O que fazer | Resultado esperado |
|---|---|---|
| C1 | Percorra as mesmas telas do passo B1. | Fundo escuro em todas as telas, inclusive barras de título, abas e barra de status. Nenhum texto escuro sobre fundo escuro. |
| C2 | Abra um evento e toque em "Excluir". | O botão vermelho "Excluir" do diálogo tem texto escuro sobre vermelho claro, fácil de ler. |
| C3 | Toque num campo de texto (ex.: busca, título do evento). | O campo em foco ganha uma borda azul clara bem visível. Sem foco, a borda é fraca (problema conhecido). |
| C4 | Desligue a internet. | A faixa "Sem internet" fica legível (amarelo sobre marrom escuro). |

### D. Remover animações

**Como ajustar:** Configurações > Acessibilidade > "Remover animações" (em alguns aparelhos fica em Acessibilidade > Visibilidade, ou em Opções do desenvolvedor > Escala de animação).

| Passo | O que fazer | Resultado esperado |
|---|---|---|
| D1 | Navegue entre telas e abra listas de opções (ex.: "Tipo de agenda"). | O app funciona normalmente. **Limitação conhecida:** a lista de opções ainda sobe com animação. Anote o que viu. |
| D2 | Toque em botões, troque de aba e conclua uma tarefa. | Nada achata, quica ou balança; não sai confete; o botão "+" fica parado. As telas trocam com um esmaecer curto. |
| D3 | Feche e abra o app. | Depois da vinheta da CK, a esfera da abertura aparece parada e some com um esmaecer, sem crescer pela tela. |

### E. Daltonismo e cores

**Como simular:** Configurações > Acessibilidade > "Correção de cor" ou, se as Opções do desenvolvedor estiverem ativas, Opções do desenvolvedor > "Simular espaço de cores" > "Monocromacia" (tudo em cinza) ou "Deuteranomalia" (vermelho-verde).

| Passo | O que fazer | Resultado esperado |
|---|---|---|
| E1 | Com "Monocromacia", olhe a aba Agenda e a lista de eventos. | Dá para saber qual evento é cancelado, recorrente, privado, pendente ou em conflito pelas **palavras** das etiquetas. |
| E2 | Ainda em cinza, abra Filtros e marque algumas opções. | As opções marcadas mostram ✓. |
| E3 | Em "Nova agenda", escolha uma cor. | A cor escolhida mostra ✓. **Limitação conhecida:** não aparece o nome da cor escrito; anote se ficou difícil saber qual cor é qual. |

### F. Áreas de toque

| Passo | O que fazer | Resultado esperado |
|---|---|---|
| F1 | Use o app só com o polegar, sem caneta, segurando o celular com uma mão. | Botões, itens de lista e campos são fáceis de acertar. Anote os que exigiram mais de uma tentativa (suspeitos: dias da grade mensal em celulares estreitos, opções em forma de "pílula" como os dias da semana e os lembretes). |

### Registro dos resultados

Copie esta tabela para anotar cada rodada de teste.

| Passo | Aparelho e versão do Android | Passou? (sim/não) | Observação |
|---|---|---|---|
| A1 | | | |
| ... | | | |

## Limitações conhecidas

Limitações que **não foram resolvidas na primeira versão**:

1. **Nenhum teste em aparelho real com TalkBack, fonte grande ou simulador de daltonismo.** Tudo foi verificado lendo o código e calculando cores. O roteiro acima precisa ser executado antes de considerar a acessibilidade validada.
2. **Sem testes automáticos de acessibilidade.** A biblioteca `@testing-library/react-native` está instalada, mas nenhum teste renderiza telas ou confere rótulos (veja [TESTES.md](TESTES.md)).
3. **Nome das cores não aparece na tela**, só é lido pelo leitor de tela (`colorName()` não é usado).
4. **Dias da grade mensal menores que 48 dp de largura** em telas com menos de 368 dp.
5. **Sem contorno de foco próprio** em botões e itens de lista para quem navega por teclado físico ou "Acesso com interruptor".
6. **Barras e bolinhas de agenda** abaixo de 3:1 contra o cartão em duas cores (Laranja no claro, Azul no escuro); impacto pequeno, porque o nome da agenda aparece escrito.
7. **Sem ajuste de tamanho de fonte dentro do app:** o app segue o tamanho escolhido no Android.
8. **Somente português do Brasil** nesta versão.

## Próximos passos sugeridos

Em ordem de impacto:

1. Executar o roteiro manual em pelo menos um celular Android com TalkBack e registrar os resultados.
2. Mostrar o nome da cor escrito no seletor de cor (usar `colorName()`).
3. Criar testes automáticos simples de acessibilidade com `@testing-library/react-native` (por exemplo, conferir que todo botão tem rótulo).
