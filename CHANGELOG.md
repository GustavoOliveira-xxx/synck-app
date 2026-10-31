# Histórico de versões

## 3.2.0 (31/10/2026)

Polimento geral: navegação coerente, telas com movimento, agendas mais fáceis de usar e a marca SynCK presente no dia a dia.

- **Voltar sempre faz sentido:** toda tela interna tem voltar no topo. Se ela foi aberta direto por um link (ou depois de recarregar a página), o voltar sobe para a tela de onde ela normalmente vem (membros voltam para a agenda, a agenda volta para Agendas, a edição volta para o detalhe), em vez de sempre ir para a tela Hoje. Telas de criar e editar mostram "Fechar" (X) e sobem de baixo.
- **Nada se perde sem querer:** fechar um formulário com algo digitado (evento, tarefa, anotação, hábito, nova agenda, adição rápida) pergunta antes de descartar. No navegador, fechar a aba também avisa.
- **Telas com movimento:** cada tela entra em cascata, bloco por bloco; trocar de aba desliza a tela; o ícone da aba escolhida pula; o mês troca deslizando o dedo para os lados.
- **Agenda redesenhada:** cabeçalho na cor da agenda com os participantes, atalhos para Novo evento, Convidar, Ver no calendário e Horário em comum, os próximos compromissos dela e, depois, as ferramentas e ajustes.
- **Cadastrar ficou mais direto:** "+" em cada cartão de agenda; no Calendário, o "+" abre o evento no dia escolhido (e na agenda filtrada), cada dia tem Evento, Tarefa e Lembrete, e tocar num horário vazio da semana ou do dia já abre o evento naquele horário. Horários livres da tela Hoje abrem o evento com início e fim preenchidos.
- **Formulário de evento:** título primeiro, agenda em chips coloridos, durações rápidas (30 min, 1 h, 1 h 30, 2 h) e o término acompanha o início.
- **Formulário de tarefa:** prazos rápidos (Hoje, Amanhã, Próxima semana) e o título acompanha o tipo (tarefa ou lembrete).
- **Marca SynCK:** o personagem do logo aparece no topo da tela Hoje, como assistente na adição rápida, no carregamento e na comemoração ao entrar numa agenda.
- Tela Hoje com um resumo do dia abaixo da saudação.

### Corrigido

- "Ver no calendário" de uma agenda abria a tela Hoje; agora abre a aba Calendário filtrada.
- Depois de aceitar um convite, o botão "Calendário" abria a tela Hoje.
- Evento começando às 23h (pela adição rápida ou pelo toque na grade) ficava com término igual ao início e não salvava; agora termina no dia seguinte.
- Lembrete criado entre 23h e meia-noite ficava para meia-noite do mesmo dia (no passado); agora vai para o dia seguinte.
- Trocar de Tarefa para Lembrete sem prazo deixava o lembrete sem data; agora sugere a próxima hora.
- Salvar as configurações da agenda agora volta para a agenda.
- O código de confirmação do e-mail tinha um "Voltar" repetido embaixo do voltar do topo.
- O item "Membros" usava o ícone de agendas.

## 3.1.0 — 26/10/2026

- Titillium Web em toda a interface, incluída no aplicativo para uso sem internet.
- Coleção de 79 ícones próprios em SVG, com 89 nomes de interface; a marca Google também tem original SVG. Os mesmos traçados são renderizados no Android e na web.
- Resposta ao toque uniforme em botões, abas, dias do calendário, linhas, seletores e ações de avisos. Retorno mais curto e sem oscilação.
- Foco suave nos campos, indicação de foco pelo teclado e preservação da aparência de controles desabilitados.
- Entradas mais rápidas e respeito à preferência de reduzir movimento.


Todas as mudanças relevantes do app ficam registradas aqui. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/): `MAIOR.MENOR.CORREÇÃO`.

- **MAIOR:** mudança que exige ação de quem usa (por exemplo, reinstalar).
- **MENOR:** funcionalidade nova.
- **CORREÇÃO:** conserto sem funcionalidade nova.

O número da compilação (build) cresce a cada APK gerado e aparece em **Perfil**, no fim da tela.

## [Não lançado]

Nada ainda.

## [3.0.2] (2026-10-25)

### Corrigido

- **Itens por cima de outros no navegador:** na tela Hoje, a tarefa do dia ficava embaixo do título da seção seguinte. A causa eram as animações de entrada, que no navegador às vezes deixavam o item fora do fluxo da página. Agora, no navegador, todas as entradas usam um esmaecer que não mexe no layout (no Android nada muda), e os testes de tela conferem isso em todas as telas fotografadas.
- Detalhes do evento no computador: o topo virou um cartão inteiro, em vez de ficar cortado pela barra de título.
- Semana no celular: o nome do evento não quebra mais no meio da palavra ("Cons / ulta"); aparece numa linha com reticências.
- Tarefas só com título ficam centralizadas na linha.
- Planejar minha semana e horários livres começam no próximo quarto de hora (13:30, e não 13:26).
- Aviso de tarefa "Na hora do prazo" (antes dizia "No horário do evento"); "prazo amanhã" com letra minúscula.
- Anotações e Hábitos deixam espaço no fim para o botão "+" não cobrir o último item.

## [3.0.1] (2026-10-25)

### Corrigido

- **Não dava para sair de "Seu dia"** quando a tela era aberta direto pelo endereço (recarregar a página, link ou ícone da Tela de Início): "Agora não" e "Começar o dia" não faziam nada e o ícone de casa reabria a pergunta. Agora, sem tela anterior, o app vai para a tela Hoje, e a pergunta não reabre sozinha no mesmo dia. A mesma correção vale para todos os botões de voltar, salvar e cancelar do app.

### Adicionado

- Em "Seu dia", botões **Tarefa**, **Evento** e **Lembrete** abrem o formulário completo (data, horário, avisos, repetição, prioridade, agenda e demais detalhes), já com a data de hoje; a tarefa criada entra no seu dia.
- Tocar num item do seu dia, numa tarefa ou num compromisso de hoje abre os detalhes para ver ou editar.

## [3.0.0] (2026-10-24)

O SynCK deixa de ser só calendário e passa a organizar o dia: tarefas, lembretes, planejamento e colaboração. Nada da 2.0 foi apagado; quem atualiza o APK mantém tudo.

### Adicionado

- **Tarefas** (nova aba): prazo com ou sem horário, prioridade, estado (pendente, em andamento, aguardando, concluída, cancelada), descrição, links, etiquetas, estimativa de duração, subtarefas com barra de progresso, listas e caixa de entrada.
- **Visões de tarefas:** Hoje, Próximos 7 dias, Esta semana, Atrasadas, Sem data, Importantes, Atribuídas a mim, Compartilhadas, Lembretes e Concluídas, com filtros e ordenações.
- **Tarefas que se repetem:** pelo calendário ("todo dia 5", "toda segunda") ou depois da conclusão ("3 dias depois de concluir"), com histórico de cada conclusão.
- **Lembretes avulsos:** um aviso numa data, sem ocupar horário na agenda.
- **Botão "O que você deseja adicionar?"**: evento, tarefa, lembrete, anotação ou hábito, com **adição rápida** em português ("Reunião com Paulo terça das 14h às 15h", "Pagar luz todo dia 10 #casa !!") e prévia para conferir quando algo é ambíguo.
- **"O que você pretende fazer hoje?"**: na primeira abertura do dia, mostra o que já está marcado, deixa acrescentar o que você vai fazer e sugere o que você costuma fazer (hábitos, tarefas que se repetem, o que você conclui com frequência), sempre dizendo o motivo. Pode ser desligada em Perfil > Preferências.
- **Tela Hoje** reorganizada: próximo compromisso, agenda, tarefas, atrasadas, lembretes, movimento nas agendas, horários livres e o resumo da semana, com seções que recolhem.
- **Calendário profissional:** grade de horários de verdade nas visões de semana e dia, eventos ao mesmo tempo lado a lado, linha do horário atual, marcadores de tarefas e lembretes no mês, filtro por tipo (eventos, tarefas, lembretes) e **arrastar para mudar o horário** (toque longo), com alternativa por botões para quem não arrasta.
- **Blocos de tempo:** reserve na agenda o tempo de fazer uma tarefa.
- **Planejar minha semana:** sugere blocos para as tarefas com prazo nos horários livres, por regras fixas, e só grava depois que você confirma.
- **Minha semana em sintonia:** compromissos, prazos, atrasadas, tempo livre e agendas compartilhadas dos próximos 7 dias, com sugestões.
- **Tarefas compartilhadas:** responsável, participantes, privacidade, comentários e histórico; avisos quando alguém atribui, conclui ou comenta.
- **Encontrar horário em comum** numa agenda compartilhada, usando só horários ocupados (sem detalhes), e **enquetes de horário** com votos "Posso", "Talvez" e "Não posso".
- **Anotações** por agenda ou pessoais, com fixar no topo e links clicáveis.
- **Hábitos e rotinas** com marcação diária e sequência opcional.
- **Busca em tudo:** eventos, tarefas, lembretes, anotações e agendas, com etiquetas (`#casa`) e filtros de concluídas e atrasadas.
- **Exportar e importar .ics** (Google Agenda, Outlook, Apple), sem duplicar o que já foi importado.
- **Notificações de tarefas:** no Android com os botões Concluir e Adiar; no iPhone e no computador pelo navegador. Nova chave em Perfil > Notificações para avisos de tarefas.
- **Preferências de planejamento:** horário em que seu dia começa e termina, pergunta diária e compartilhar disponibilidade.
- A exportação de dados (LGPD) e a exclusão de conta incluem tarefas, lembretes, listas, anotações, hábitos, plano do dia e votos.

### Corrigido

- O lembrete adiado ("Adiar 10 min") sumia se o app sincronizasse nos 10 minutos seguintes. Agora o adiamento fica guardado e é reagendado sem duplicar.
- Textos com plural "item(ns)" aparecem certos ("1 item", "3 itens").

### Banco de dados

- Nova migration `20261023000800_tarefas.sql`, só com acréscimos (nenhuma tabela antiga foi alterada de forma incompatível). Detalhes em [MODELO_DE_DADOS.md](MODELO_DE_DADOS.md) e decisões D30 a D38 em [DECISOES.md](DECISOES.md).

### Testes

- Banco: 92 testes (21 novos, incluindo os mesmos 24 casos de próxima data usados no app).
- App: 190 testes unitários (79 novos, incluindo alertas de tarefas e o adiamento de lembretes).
- Telas: 8 testes na versão web, com um novo cobrindo tarefas, criação universal, planejamento, horário em comum e busca.
- O que ainda depende de teste em aparelho está em [docs/VALIDACAO_3.0.md](docs/VALIDACAO_3.0.md).

## [2.0.0] (2026-10-22)

O app agora se chama **SynCK** (um produto CK Group) e ganhou a identidade visual completa.

### Adicionado

- **Identidade SynCK:** ícone com o personagem do logo (inclusive o ícone temático do Android 13+), splash, logo no login, no menu lateral e na tela Sobre, cores claras e escuras do pacote de marca, fontes Bricolage Grotesque (títulos) e Figtree (texto) e os ícones de interface da marca.
- **Tela Hoje:** data, saudação, semana compacta, faixa de sincronização e os compromissos do dia em cartões, com o selo "Agora" no que está acontecendo.
- **Decoração animada:** esfera de vidro com névoa, anéis de órbita com satélites, mascote Kairo nos estados vazios e estrelas ao confirmar presença. Tudo proporcional ao tamanho da tela, parado em segundo plano e sem animação para quem pede "reduzir movimento".
- **Microinterações:** botões e cartões afundam com mola, o "+" gira, a pílula das abas escorrega, listas entram em cascata e o mês desliza ao trocar.
- **"Você vai?"** no evento: Vou, Talvez ou Não vou, com a resposta de cada participante.
- **Entrar com Google** (depois de ativar no Supabase, veja o GUIA_DE_DEPLOY.md, parte 9).
- **Notificações no iPhone e no computador:** lembretes e avisos chegam pelo navegador depois de ativar em Perfil > Notificações (no iPhone, com o SynCK adicionado à Tela de Início).
- **Lembretes do Android com a marca:** título que começa pelo que importa ("Em 30 min: ..."), cor e ícone do SynCK e os botões Abrir e Adiar 10 min.
- Filtros de agenda em chips no calendário e nas Agendas; cartões de agenda com papel, próximo compromisso e avatares.

### Alterado

- Navegação: Hoje, Calendário, Agendas e Perfil. Os Avisos ficam no sino da tela Hoje.
- O tema segue sempre o do aparelho (claro ou escuro); a opção de tema saiu das Preferências.
- Agendas e avatares antigos aparecem na cor SynCK mais próxima, sem mudar nada no banco.

## [1.2.0] (2026-10-21)

### Corrigido

- No computador (versão web publicada no GitHub Pages), o app mostrava "Sem internet" mesmo conectado e bloqueava criar agenda, gerar convite e outras ações. O teste de conexão agora usa um arquivo do próprio site.
- Depois de uma falha de rede passageira, o app volta a ficar online sozinho (confere de novo a cada 15 segundos).
- A versão web guarda todos os arquivos na instalação e abre sem internet desde o primeiro acesso.

### Adicionado

- Aviso de versão nova no app Android, com botão para baixar o APK.
- Arquivo de identidade visual (`src/theme/marca.ts`): cores, fonte própria, cantos, sombra e detalhes de estilo num lugar só. Passo a passo em `docs/DESIGN.md`.
- Teste automático de contraste das cores da marca.

### Alterado

- Visual neutro, pronto para receber uma identidade: tons de cinza, cantos menores, sem ícones dentro dos botões, títulos de seção sem letras maiúsculas e ícones provisórios.

## [1.1.0] (2026-10-21)

Funciona em iPhone, iPad e computador, e a tela se adapta ao tamanho.

### Adicionado

- **Versão web instalável (PWA):** abre no navegador de qualquer sistema e pode ser adicionada à tela de início (iPhone: Safari > Compartilhar > Adicionar à Tela de Início). Tem ícone próprio, abre em tela cheia, funciona sem internet depois do primeiro acesso e se atualiza sozinha.
- **Publicação automática no GitHub Pages** (workflow "Publicar versão web"), com testes de instalação e de abertura sem internet antes de publicar.
- **Layout responsivo:** menu lateral no tablet e no computador; no computador, mês e eventos do dia lado a lado; formulários e listas centralizados; diálogos no centro da tela.
- O app gira (retrato e paisagem) e aceita iPad.
- No navegador: seletor de data e hora do próprio navegador; compartilhar copia o texto quando não há folha de compartilhamento; a exportação de dados baixa um arquivo; botão para ir ao início em telas abertas por link.
- Testes de tela em tamanho de tablet e de computador.
- Passo a passo para publicar um app nativo de iPhone na App Store (exige conta paga da Apple).

### Limitações

- Na versão web, os lembretes ficam salvos mas não tocam (o app avisa). Só o app Android toca lembretes.

## [1.0.0] (2026-10-20)

Primeira versão.

### Adicionado

- **Conta:** cadastro, login, confirmação de e-mail por código (opcional), recuperação de senha por código, troca de senha, perfil com avatar de iniciais, aparelhos conectados, sair (apaga os dados do aparelho).
- **Agendas:** várias por pessoa, tipos (pessoal, compartilhada, família, profissional, projeto, viagem e personalizada), cor, fuso horário, configurações (quem convida, eventos privados, conflito de horário), arquivar, duplicar, lixeira de 30 dias. "Minha agenda" criada no cadastro.
- **Compartilhamento:** convite por código de 12 caracteres ou para e-mail cadastrado, prévia antes de aceitar, validade, limite de usos, cancelamento, troca de papel antes do aceite, limite de tentativas.
- **Papéis:** proprietário, administrador, editor, colaborador e visualizador; mudança de papel, remoção com perda de acesso imediata, saída, transferência de propriedade.
- **Eventos:** criar, editar, duplicar, cancelar, concluir, excluir e restaurar; dia inteiro; local, link e observações; participantes; privacidade (todos os membros, só participantes, privado, ocupado); comentários.
- **Recorrência:** diária, semanal com dias da semana, quinzenal, mensal, anual, fim por data ou quantidade; editar e excluir "só este", "este e os próximos" ou "todos".
- **Calendário:** mês, semana, dia e lista; filtros; busca.
- **Lembretes:** notificações locais, horário de silêncio, detalhes ocultos na tela bloqueada por padrão.
- **Offline:** cache local, fila de alterações com novas tentativas, tela de sincronização e resolução de conflitos.
- **Tempo real:** atualização automática quando outras pessoas mudam algo.
- **Avisos e histórico:** central de avisos no app e histórico de alterações por agenda.
- **Privacidade (LGPD):** exportação dos dados pessoais, exclusão de conta com explicação do impacto, política de privacidade no app.
- **Servidor:** banco PostgreSQL no Supabase com regras de acesso (RLS) em todas as tabelas, funções no servidor, auditoria e limites de requisições; dados de demonstração fictícios.
- **Qualidade:** testes automáticos do banco (PGlite) e do app (Jest), lint, formatação e checagem de tipos no GitHub Actions; verificação de segredos.
- **Distribuição:** geração de APK e AAB no GitHub Actions, com publicação na página Releases, assinatura com chave própria quando configurada e lista fechada de permissões do Android.
- **Documentação** completa em português do Brasil.

### Limitações conhecidas

Veja [README.md, Limitações conhecidas](README.md#limitações-conhecidas).
