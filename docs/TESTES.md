# Testes

Este documento explica como o projeto é testado, o que já roda sozinho, como rodar cada teste no seu computador e como testar o app com o celular na mão (roteiro manual).

## Resumo em números

Resultado conferido em 24/10/2026 (versão 3.0.0), rodando os comandos abaixo neste repositório:

| O quê | Pasta e comando | Arquivos | Testes | Resultado | Tempo |
|---|---|---|---|---|---|
| Testes do banco (integração) | `supabase`: `npm test` | 10 | **92** | 92 passaram, 0 falharam | cerca de 5 min |
| Testes do app (unitários) | `app-mobile`: `npm test -- --ci` | 20 | **190** | 190 passaram, 0 falharam | poucos segundos |
| Tipos (TypeScript) | `app-mobile`: `npm run typecheck` | | | sem erros | |
| Lint (ESLint) | `app-mobile`: `npm run lint` | | | sem erros | |
| Formatação (Prettier) | `app-mobile`: `npm run format:check` | | | "All matched files use Prettier code style!" | |
| Segredos no repositório | raiz: `bash scripts/verificar-segredos.sh` | | | "OK: nenhum segredo encontrado nos arquivos versionados." | |
| Testes de tela (versão web: celular, tablet e computador) | `e2e`: `npm run preparar` e `npm test` | 1 | **9** | 9 passaram, 0 falharam | cerca de 40 s (mais 1 a 2 min para gerar a versão web) |
| Versão instalável (PWA) | `e2e`: `npm run preparar:site` e `npm run test:site` | 1 | **7** | 7 passaram, 0 falharam | cerca de 20 s (mais 1 a 2 min para gerar o site) |
| Testes de interface no Android (emulador ou celular) | | 0 | **0** | não automatizados; use o [roteiro manual](#roteiro-de-teste-manual) | |

**Total automatizado: 298 testes** (92 do banco + 190 do app + 9 de tela + 7 da versão instalável). A função de notificações do navegador também passa pela verificação de tipos do Deno (`deno check`) e por uma conferência de que usa a mesma lógica de datas do app.

> **Importante:** os testes de tela abrem a **versão web** do app (o mesmo código do APK) num navegador com tamanho de celular, ligada a um "Supabase de mentira" que usa o **banco real** do projeto (PGlite com as migrations e os dados de demonstração). Eles não usam um celular Android de verdade, nem o Supabase Auth real, nem as notificações do Android. Isso continua no roteiro manual deste documento.

## Estratégia: a pirâmide de testes

Pense numa pirâmide com três andares:

```
            /\
           /  \        Topo: testes de interface (UI / ponta a ponta)
          / UI \       Poucos, lentos, usam o app de verdade.
         /------\      AQUI: só manuais (roteiro abaixo).
        /        \
       /Integração\    Meio: testes do banco de dados
      /------------\   Banco PostgreSQL de verdade, com as regras de acesso.
     /              \  AQUI: 69 testes em supabase/tests.
    /   Unitários    \
   /------------------\ Base: testes de funções isoladas
                        Muitos, rápidos (segundos), sem rede e sem celular.
                        AQUI: 78 testes em app-mobile/src.
```

- **Base (unitários):** testam pedaços pequenos de lógica, como "converter 10h de São Paulo para o horário universal" ou "calcular as repetições de um evento mensal no dia 31". São muitos, rodam em segundos e apontam exatamente onde está o erro.
- **Meio (integração):** testam o banco de dados **inteiro**, com as migrations reais, fingindo ser cada pessoa logada. É aqui que se confirma o mais importante do projeto: **quem pode ver e mudar o quê**. Como toda permissão é conferida no banco (veja [SEGURANCA.md](../SEGURANCA.md)), estes testes protegem os dados mesmo que alguém use um app modificado.
- **Topo (interface):** testam o app como uma pessoa usaria, tocando na tela. São os mais caros. Nesta versão há um meio-termo automático: a versão web do app é aberta num navegador e percorre as telas principais (pasta `e2e/`). Os testes no próprio Android (emulador ou celular) ficaram **manuais**.
- **Chão (verificações automáticas de código):** TypeScript, ESLint e Prettier não são "testes", mas pegam muitos erros antes de qualquer teste rodar (tipo errado, variável esquecida, código bagunçado).

A escolha foi colocar o esforço onde o risco é maior: regras de permissão e privacidade (banco) e cálculos difíceis de datas, fusos, recorrência e fila offline (app).

## O que está automatizado

### Testes do banco (`supabase/tests`)

**Como funcionam, em linguagem simples:**

- Usam o **PGlite**, um PostgreSQL de verdade que roda dentro do Node.js. Não precisa de Docker, internet nem conta no Supabase.
- `tests/helpers/db.mjs` cria um banco vazio, aplica `tests/helpers/supabase-shim.sql` (uma simulação mínima do ambiente Supabase: papéis `anon`, `authenticated` e `service_role`, a tabela `auth.users` e a função que diz quem está logado) e depois aplica **todas as migrations** de `supabase/migrations`, na ordem. O shim **não** vai para o Supabase real.
- A função `db.as(pessoa, sql)` executa um comando **como se fosse aquela pessoa logada**, então as regras de acesso (RLS) valem de verdade.
- `tests/helpers/scenario.mjs` monta sempre o mesmo grupo fictício: Ana (proprietária), Bruno (editor), Carla (colaboradora), Davi (visualizador), Eva (administradora) e Fabio (sem acesso), com e-mails `@exemplo.test`, na agenda "Casa".

| Arquivo | Testes | O que cobre |
|---|---|---|
| `01_conta.test.mjs` | 6 | Cadastro cria perfil, preferências e "Minha agenda" com a pessoa como proprietária; fuso inválido vira `America/Sao_Paulo`; visitante sem login não acessa nada; perfil de outra pessoa só aparece para quem divide agenda e nunca mostra o e-mail; preferências só a própria pessoa lê e altera; registro de aparelhos sem duplicar. |
| `02_agendas_membros.test.mjs` | 13 | Quem não é membro não vê agenda, membros nem eventos; ninguém escolhe outro dono ao criar agenda; administrador não mexe nas configurações exclusivas do dono; ninguém é adicionado em silêncio; ninguém aumenta o próprio papel; quem gerencia quais papéis; **remover membro tira o acesso na hora**; administrador não remove outro administrador nem o dono; dono não sai sem transferir; arquivar deixa somente leitura; lixeira esconde de todos; duplicar agenda copia só o que a pessoa pode ver; quem vê a "última atividade"; toda agenda tem exatamente um dono. |
| `03_convites.test.mjs` | 14 | Código legível, guardado só como hash; aceitar dá o papel do convite e repetir o aceite não duplica; convite de uso único não serve para segunda pessoa; **convite cancelado ou expirado não pode ser aceito**; convite "esgotado"; muitos códigos errados bloqueiam por um tempo; convite por e-mail só para o dono do e-mail confirmado; **recusar** avisa quem convidou; novo convite para o mesmo e-mail substitui o pendente; quem pode convidar e com qual papel; dono muda o papel antes do aceite; pessoa removida pode voltar com novo convite; convite de agenda arquivada ou na lixeira não vale. |
| `04_eventos.test.mjs` | 11 | Quem pode criar evento por papel (visualizador não cria); o criador é sempre quem está logado; colaborador edita só os próprios, editor conforme a política; validações no servidor (término depois do início, link, título, recorrência); eventos de dia inteiro; **exclusão lógica** com restauração e reenvio sem erro; cancelado fica no histórico; política de conflito de horário "bloquear" e "avisar"; não dá para mover evento para outra agenda nem mudar campos protegidos; lembretes são pessoais e participantes precisam ser membros; comentários por papel. |
| `05_sincronizacao.test.mjs` | 8 | Reenviar a mesma criação não duplica; id de evento de outra pessoa não pode ser reaproveitado; **duas pessoas editam o mesmo evento: a segunda recebe conflito** com a versão do servidor; editar offline um evento que outra pessoa excluiu vira conflito "excluído"; excluir com versão antiga também é conflito; alterar ou cancelar uma ocorrência preserva a série; "esta e as próximas" encerra a série e cria a nova numa operação só; operação inválida ou sem login é recusada. |
| `06_privacidade_busca.test.mjs` | 7 | Evento privado: só quem criou vê (nem o dono da agenda); agenda pode proibir privados; "ocupado": membros veem só o horário; "só participantes"; editor não consegue esconder evento de outra pessoa; **busca respeita permissões** e trata caracteres especiais; histórico de evento privado não revela o título. |
| `07_avisos_lgpd.test.mjs` | 8 | Criar evento avisa os outros membros (não quem criou); evento privado não gera aviso; pessoa removida recebe aviso e para de receber os da agenda; cada um vê e marca como lido só os seus avisos; mudanças administrativas ficam na auditoria, que ninguém lê pela API; exportação traz os dados da própria pessoa; exclusão de conta exige confirmação, bloqueia dono de agenda compartilhada e informa o impacto; limpeza da lixeira não pode ser chamada pelo app. |
| `08_seed.test.mjs` | 2 | O `seed.sql` cria o cenário de demonstração completo e respeita a privacidade; o seed **não roda** em banco que já tem usuários (proteção contra rodar em produção). |
| `09_synck_push.test.mjs` | 2 | Confirmação de presença (Vou, Talvez, Não vou) e inscrições de notificação no navegador só da própria pessoa. |
| `10_tarefas.test.mjs` | 21 | Versão 3.0: tarefa simples; **tarefa pessoal invisível para quem divide outra agenda e escrita direta proibida**; papéis, privacidade e responsável; reenvio sem duplicar; conflitos; **recorrência pelo calendário e depois da conclusão, concluindo uma vez só mesmo em dois aparelhos**; alertas e "Meu dia" pessoais; subtarefas; listas; mover entre pessoal e agenda; membro removido perde as tarefas na hora; comentários e histórico; anotações; hábitos; **encontrar horário sem títulos e com outras agendas só por autorização**; enquetes; blocos de tempo; compatibilidade com a 2.0; exportação e exclusão de conta; os 24 casos de próxima data compartilhados com o app. |
| **Total** | **92** | |

**O que os testes do banco não cobrem:**
- O **Supabase Auth** de verdade (login, logout, recuperação de senha, envio de e-mail, renovação de sessão). Ele é um serviço separado que não existe no PGlite; o shim só simula a tabela `auth.users`.
- A camada de API do Supabase (PostgREST), o Realtime (atualização ao vivo) e as configurações do painel. Os testes chamam o SQL diretamente, com os mesmos papéis que a API usaria.

### Testes do app (`app-mobile/src/**/__tests__`)

**Como funcionam:** usam o **Jest** com a predefinição `jest-expo` (configuração no `package.json`, campo `jest`). O arquivo `jest.setup.js` troca o armazenamento do celular (AsyncStorage) por uma versão de mentira, porque os testes rodam no computador. Os testes chamam **funções puras** (sem tela, sem rede).

| Arquivo | Testes | O que cobre |
|---|---|---|
| `src/validation/__tests__/validation.test.ts` | 9 | Cadastro e login (nome, e-mail válido, senha forte, confirmação igual); agenda (nome obrigatório, limites, cor); evento (formulário novo começa na próxima hora cheia com 1 hora de duração; título obrigatório, término depois do início, link e textos; dia inteiro; recorrência consistente e limite de 5 lembretes; **conversão do formulário para o formato do servidor** com horário universal, fuso e datas locais; ida e volta evento, formulário, campos sem perder dados); código de convite normalizado igual ao servidor. |
| `src/utils/__tests__/dates.test.ts` | 12 | Hora local do Brasil para UTC; o mesmo instante em dias diferentes conforme o fuso; evento criado em São Paulo visto em Lisboa; dia inteiro sem "pular" de dia; evento que termina à meia-noite; horário de verão (Nova York e Brasil 2018); contas com datas; grade do mês com 6 semanas; formatação em português; validação de fuso e de data; horário de silêncio atravessando a meia-noite. |
| `src/utils/__tests__/recurrence.test.ts` | 18 | Ler e escrever regras de repetição (RRULE); recusar regras inválidas; atalhos e descrição em português; repetição mensal no dia 31; semanal em vários dias; quinzenal; horário de verão; evento em outro fuso; alterar e excluir uma ocorrência; série sem fim; série com 500 repetições; data final inclusiva; 29 de fevereiro; dia inteiro de vários dias; evento fora do período; edição de séries ("esta e as próximas" encerra a original no dia anterior, contagem restante, primeira ocorrência vira "todas"). |
| `src/utils/__tests__/filters.test.ts` | 6 | Filtros por agenda, tipo, status, autoria, privacidade, recorrência, participante, cor e período; **busca local** ignorando acentos e maiúsculas, sem revelar eventos mascarados; **conflitos de horário** (sobreposição, ignorando o próprio evento, cancelados e dia inteiro; pares em conflito). |
| `src/utils/__tests__/permissions.test.ts` | 5 | Permissões na interface (espelham o servidor): visualizador não cria nem comenta; agenda arquivada é somente leitura; colaborador edita só os próprios; quem pode convidar e quais papéis concede; ninguém gerencia a si mesmo nem o dono. |
| `src/utils/__tests__/errors.test.ts` | 5 | Mensagens de erro amigáveis: códigos do servidor viram frases sem detalhes internos; falta de internet é erro temporário; erros de login; erro desconhecido vira mensagem genérica; e-mails, tokens e senhas são removidos antes de ir para o registro (log). |
| `src/offline/__tests__/outbox.test.ts` | 13 | **Fila offline (9):** alterações num evento ainda não enviado entram na criação; criar e excluir antes de enviar não manda nada; duas edições viram uma; não mexe no que já está sendo enviado; envia na ordem e segura o resto se houver conflito; falha temporária espera cada vez mais e para depois de várias tentativas; erro permanente não tenta de novo sozinho; app fechado durante o envio devolve a operação para a fila; a tela mostra as alterações locais por cima dos dados do servidor. **Mesclagem de conflitos (4):** campos diferentes mantêm os dois lados; mesmo campo com valores diferentes vira conflito para a pessoa decidir; os dois chegaram ao mesmo valor; horário é tratado como bloco. |
| `src/services/__tests__/reminders.test.ts` | 5 | **Planejamento dos lembretes** (`planReminders` em `src/services/localNotifications.ts`): cada lembrete fica no horário do evento menos a antecedência; ignora lembretes que já passaram, eventos cancelados e concluídos; só agenda os próximos 30 dias, inclusive em eventos que se repetem; sem lembretes, nada é agendado. **Textos** (`reminderLabel` em `src/utils/reminders.ts`): "No horário do evento", "15 minutos antes", "1 hora antes", "2 dias antes" etc. |
| `src/utils/__tests__/layout.test.ts` | 5 | **Tamanhos de tela**: celular (abas embaixo, uma coluna), tablet (menu lateral, diálogos no centro), computador (duas colunas), limites exatos das faixas e centralização de blocos. |
| **Total** | **78** | |

O arquivo `src/utils/__tests__/fixtures.ts` não é um teste: guarda um evento fictício reutilizado pelos outros arquivos.

**O que os testes do app não cobrem:**
- **Nenhuma tela ou componente** é testado. A biblioteca `@testing-library/react-native` está instalada, mas ainda sem uso.
- O motor de sincronização completo (`src/offline/syncEngine.ts`), que junta fila, rede e armazenamento. Só as partes puras (fila e mesclagem) são testadas.
- Serviços que falam com o Supabase (`src/services/api.ts`, `auth.ts`, `session.ts`, `realtime.ts`).
- A entrega real das notificações pelo Android (`expo-notifications`): só o cálculo de quais lembretes agendar é testado.
- Funções menores sem teste próprio: `src/utils/activity.ts`, `timezones.ts` e `text.ts`.

### Verificações automáticas de código

Rodam na pasta `app-mobile`:

| Comando | O que faz |
|---|---|
| `npm run typecheck` | Roda `tsc --noEmit`: confere os tipos do TypeScript sem gerar arquivos. |
| `npm run lint` | Roda `eslint .`: procura erros comuns e más práticas. |
| `npm run format:check` | Roda `prettier --check .`: confere se o código está formatado no padrão. |
| `npm run check` | Roda os quatro em sequência: tipos, lint, formatação e testes. |

### Integração contínua no GitHub (`.github/workflows/qualidade.yml`)

O workflow **Qualidade** roda sozinho a cada envio (`push`), em todo pull request e também pode ser disparado à mão (aba Actions > Qualidade > Run workflow). Ele tem quatro trabalhos (jobs) que rodam em paralelo:

| Job | Pasta | Passos |
|---|---|---|
| **Verificar segredos** | raiz | `bash scripts/verificar-segredos.sh` |
| **Banco de dados (regras de acesso)** | `supabase` | Node 22, `npm ci`, `npm test` (os 69 testes do banco) |
| **App (tipos, lint, testes, empacotamento)** | `app-mobile` | Node 22, `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test -- --ci` (os 78 testes) e `npx expo export --platform android --output-dir dist-ci` (garante que o JavaScript do app Android compila) |
| **Telas (versão web, ponta a ponta)** | `e2e` | Node 22, `npm ci` em `supabase`, `app-mobile` e `e2e`, `npm run preparar` (gera a versão web) e `npm test` (os 7 testes de tela, usando o Chrome da máquina do GitHub). As capturas de cada etapa ficam em **Artifacts > capturas-das-telas** |

O workflow `.github/workflows/web.yml` ("Publicar versão web") gera o site e roda os **6 testes da versão instalável** (`e2e/site.test.mjs`) antes de publicar: abre na subpasta do site, manifesto e ícones, service worker, link direto via `404.html` e abertura sem internet. Se algum falhar, o site não é publicado.

O workflow `.github/workflows/android.yml` ("Gerar APK Android") **não roda testes**: ele só compila o APK e o AAB. Por isso, confira se o Qualidade está verde antes de distribuir um APK.

## Como rodar os testes no seu computador

Pré-requisitos: **Node.js 22 ou mais novo**, npm e Git (passo a passo de instalação no [GUIA_DE_DESENVOLVIMENTO.md](../GUIA_DE_DESENVOLVIMENTO.md)). Para conferir:

```bash
# Pasta: qualquer uma
node -v    # esperado: v22 ou maior
npm -v
```

### 1. Testes do banco

```bash
# Pasta: supabase
# Finalidade: instalar o PGlite (só na primeira vez ou depois de atualizar o projeto)
npm ci

# Finalidade: rodar os 92 testes de permissões, convites, eventos, tarefas, sincronização e privacidade
npm test
```

- **Resultado esperado:** cada teste aparece com `ok N - nome do teste`. No final:
  ```
  # tests 69
  # pass 69
  # fail 0
  ```
  Leva alguns minutos (entre 3 min 20 s e 3 min 30 s nas medições feitas), porque cada teste cria um banco novo do zero.
- **Para rodar um arquivo só** (mais rápido enquanto você trabalha):
  ```bash
  # Pasta: supabase
  node --test tests/03_convites.test.mjs
  ```
- **Se falhar:**
  - Linhas com `not ok` mostram qual teste falhou e a mensagem logo abaixo.
  - `Falha na migration ...`: há um erro de SQL na migration citada. Corrija o arquivo em `supabase/migrations`.
  - `Era esperado um erro contendo "..." mas a operação funcionou`: uma regra de permissão ficou mais frouxa do que deveria. **Não "conserte" o teste**; revise a regra no banco.
  - `Cannot find package '@electric-sql/pglite'`: faltou rodar `npm ci` nesta pasta.
  - Erro dizendo que não encontrou `tests/*.test.mjs`: provavelmente o Node.js é antigo (o padrão com `*` no `node --test` só é aceito em versões recentes). Instale o Node 22.

### 2. Testes do app

```bash
# Pasta: app-mobile
# Finalidade: instalar as dependências (só na primeira vez ou depois de atualizar o projeto)
npm ci

# Finalidade: rodar os 190 testes unitários
npm test -- --ci
```

- **Resultado esperado:**
  ```
  Test Suites: 8 passed, 8 total
  Tests:       78 passed, 78 total
  ```
- **Outras formas úteis:**
  ```bash
  # Pasta: app-mobile
  npx jest src/utils/__tests__/dates.test.ts   # um arquivo só
  npm run test:watch                           # roda de novo a cada arquivo salvo (Ctrl+C para sair)
  ```
- **Se falhar:**
  - O Jest mostra o nome do teste, o valor esperado (`Expected`) e o recebido (`Received`). Compare os dois para entender o problema.
  - `Cannot find module`: rode `npm ci` de novo nesta pasta.
  - Se passa no GitHub mas falha só no seu computador, confira a versão do Node.js (`node -v`, use a 22) e apague a pasta `node_modules` antes de rodar `npm ci` de novo.

### 3. Tipos, lint e formatação

```bash
# Pasta: app-mobile
npm run typecheck      # esperado: termina sem mensagens de erro
npm run lint           # esperado: termina sem mensagens de erro
npm run format:check   # esperado: "All matched files use Prettier code style!"
npm run check          # os quatro de uma vez (tipos, lint, formatação e testes)
```

- **Se falhar:**
  - `typecheck`: a mensagem mostra arquivo, linha e o tipo esperado. Corrija o código.
  - `lint`: a mensagem mostra arquivo, linha e a regra. Algumas podem ser corrigidas com `npx eslint . --fix`.
  - `format:check`: rode `npm run format`. **Atenção:** esse comando **altera** os arquivos para o formato padrão; revise as mudanças com `git diff` antes de salvar no Git.

### 4. Verificação de segredos

```bash
# Pasta: raiz do projeto
bash scripts/verificar-segredos.sh
```

- **Resultado esperado:** `OK: nenhum segredo encontrado nos arquivos versionados.`
- **Se falhar:** o script mostra o arquivo suspeito. Remova o segredo e siga o procedimento do [SEGURANCA.md](../SEGURANCA.md#procedimento-para-revogar-credenciais-expostas).

## Requisitos de teste e onde estão cobertos

Legenda: os nomes de arquivo `0N_*.test.mjs` ficam em `supabase/tests/`; os `*.test.ts` ficam em `app-mobile/src/**/__tests__/`. "M01" e similares são os cenários do [roteiro manual](#roteiro-de-teste-manual).

### Testes unitários

| Requisito | Coberto por | Observação |
|---|---|---|
| Validações | `validation.test.ts` (9) | O servidor também valida: `04_eventos.test.mjs` ("validações do servidor"). |
| Permissões | `permissions.test.ts` (5) | As permissões que valem de verdade estão no banco: `02`, `03`, `04` e `06`. |
| Recorrência | `recurrence.test.ts` (18) | No servidor: `05_sincronizacao.test.mjs` (exceções e "esta e as próximas"). |
| Datas | `dates.test.ts` (12) | |
| Fusos horários | `dates.test.ts` e `recurrence.test.ts` | Horário de verão, eventos em outro fuso, dia inteiro. No servidor: `01` (fuso inválido) e `04` (dia inteiro no fuso do evento). |
| Filtros | `filters.test.ts` | |
| Busca | `filters.test.ts` (busca local) | Busca no servidor com permissões: `06_privacidade_busca.test.mjs`. |
| Resolução de conflitos | `outbox.test.ts` (mesclagem, 4 testes) e `filters.test.ts` (conflito de horário) | Detecção de conflito de edição no servidor: `05_sincronizacao.test.mjs`. A **tela** de resolução não é testada (M12). |
| Conversão de dados | `validation.test.ts` (formulário para servidor e ida e volta) | |
| Regras de negócio | `permissions.test.ts`, `outbox.test.ts` | A maior parte das regras está nos testes do banco (`02` a `07`), que citam o número da regra de [REGRAS_DE_NEGOCIO.md](../REGRAS_DE_NEGOCIO.md). |

### Testes de integração

"Integração" aqui significa: o banco de dados real (migrations, regras de acesso e funções) testado como cada pessoa logada. **Não** inclui o Supabase Auth nem a rede do celular.

| Requisito | Coberto por | Observação |
|---|---|---|
| Cadastro | `01_conta.test.mjs` | Cobre o que o banco faz ao criar a conta (perfil, preferências, "Minha agenda"). A criação da conta no Supabase Auth: **não automatizado** (M01). |
| Login | **Não automatizado** | É feito pelo Supabase Auth, que não roda no PGlite. A validação do formulário está em `validation.test.ts`. Manual: M02. |
| Logout | **Não automatizado** | A limpeza dos dados do aparelho ao sair (`src/services/session.ts`) não tem teste. Manual: M02. |
| Recuperação | **Não automatizado** | Depende de envio de e-mail pelo Supabase Auth. Manual: M02. |
| Criação de agenda | `02_agendas_membros.test.mjs` | Dono correto, exatamente um proprietário. Manual: M03. |
| Convite | `03_convites.test.mjs` | Manual: M04. |
| Aceitação | `03_convites.test.mjs` | Inclusive aceite repetido e uso único. Manual: M05. |
| Rejeição | `03_convites.test.mjs` ("recusar convite por e-mail avisa quem convidou") | Manual: M05. |
| Revogação | `03_convites.test.mjs` (convite cancelado) e `02_agendas_membros.test.mjs` (remover membro revoga o acesso) | Manual: M05 e M13. |
| Criação de evento | `04_eventos.test.mjs` | Manual: M06. |
| Edição | `04_eventos.test.mjs`, `05_sincronizacao.test.mjs` | Manual: M07. |
| Exclusão | `04_eventos.test.mjs` (exclusão lógica e restauração) | Manual: M08. |
| Notificações | `07_avisos_lgpd.test.mjs` (avisos dentro do app) e `reminders.test.ts` (cálculo de quais lembretes agendar) | A entrega real do lembrete pelo Android: **não automatizado**, manual M10. |
| Sincronização | `05_sincronizacao.test.mjs` (servidor) e `outbox.test.ts` (fila do app) | O ciclo completo celular, rede, servidor (`syncEngine.ts`) não é testado automaticamente. Manual: M11 e M12. |

### Testes de interface

**Testes de tela automáticos (versão web), em `e2e/telas.test.mjs`:**

| Teste | O que confere |
|---|---|
| Primeiro acesso | A apresentação abre e a tela de login aparece |
| Senha errada | Aparece "E-mail ou senha incorretos." |
| Proprietária (Ana) | Entra; calendário do mês e lista; evento privado de outra pessoa **não** aparece; detalhes do evento com data e local; membros com papéis; gera um código de convite no formato `XXXX-XXXX-XXXX`; abre novo evento, agendas, avisos, perfil, sincronização, histórico, busca, filtros e ajuda |
| Visualizador (Davi, tema escuro) | Vê "Ocupado" no lugar dos detalhes de um evento marcado como ocupado e **não** vê o evento privado |
| Computador (1280 x 800) | Menu lateral à esquerda; mês e eventos do dia em duas colunas; detalhes do evento centralizados |
| Tablet (820 x 1180) | Menu lateral; formulário de novo evento centralizado |
| Sem erros | Nenhum erro de JavaScript em nenhuma tela e nenhuma chamada ao servidor falhou |

Como rodar no computador:

```bash
# Pasta: e2e (precisa de npm ci em supabase, app-mobile e e2e)
npm run preparar   # gera a versão web do app em app-mobile/dist-e2e (1 a 2 minutos)
npm test           # roda os 5 testes; capturas em e2e/saida/
```

O navegador usado é o Chrome/Chromium do computador: informe o caminho em `CHROMIUM_PATH` (no Linux, por exemplo, `CHROMIUM_PATH=/usr/bin/google-chrome npm test`).

**No Android (emulador ou celular), nenhum é automatizado.** Não há Detox, Maestro ou Appium configurado: exigiria emulador e servidor dentro do GitHub Actions, lento e instável para esta primeira versão. Os cenários de ponta a ponta ficam no roteiro manual (os marcados com "web" também são cobertos, em parte, pelos testes de tela acima):

| # | Cenário | Status | Roteiro manual |
|---|---|---|---|
| 1 | Criar usuário | Não automatizado | M01 |
| 2 | Fazer login | Parcial: web, com o servidor de testes | M02 |
| 3 | Criar agenda | Não automatizado | M03 |
| 4 | Convidar participante | Parcial: web (gerar código) | M04 |
| 5 | Aceitar convite | Não automatizado | M05 |
| 6 | Criar evento | Não automatizado | M06 |
| 7 | Visualizar evento em outro dispositivo | Não automatizado | M06 (passo 6) |
| 8 | Editar evento | Não automatizado | M07 |
| 9 | Receber atualização | Não automatizado | M07 (passo 5) |
| 10 | Remover usuário | Não automatizado | M13 |
| 11 | Confirmar perda de acesso | Não automatizado | M13 (passos 5 a 7) |
| 12 | Criar evento offline | Não automatizado | M11 |
| 13 | Sincronizar após reconexão | Não automatizado | M11 (passos 6 a 8) |
| 14 | Resolver conflito | Não automatizado | M12 |

### Dados de teste reproduzíveis

- **Banco:** `supabase/tests/helpers/scenario.mjs` cria sempre as mesmas pessoas fictícias e a mesma agenda; `uuid()` em `helpers/db.mjs` gera ids previsíveis; cada teste começa com um banco novo.
- **App:** `app-mobile/src/utils/__tests__/fixtures.ts` e datas fixas dentro dos testes (ex.: `2026-11-10T22:00:00Z`).
- **Demonstração e testes manuais:** `supabase/seed.sql`, com ids fixos e datas **relativas ao dia de hoje** (por exemplo, "jantar daqui a 3 dias"), para o cenário fazer sentido em qualquer data. O próprio seed é testado em `08_seed.test.mjs`.

## Roteiro de teste manual

Escrito para quem não programa. Siga os passos na ordem e compare com o **resultado esperado**. Anote o que for diferente na [tabela de registro](#registro-dos-resultados).

### Preparação

**1. Servidor com dados de demonstração (recomendado: Supabase local).**
O arquivo `supabase/seed.sql` cria contas e eventos fictícios. Ele **só roda no Supabase local** (no computador, com Docker): é aplicado sozinho pelo `npx supabase start` e de novo a cada `npx supabase db reset`. Por segurança, ele também se recusa a rodar em qualquer banco que já tenha usuários. **Não use o seed no projeto de produção.** O passo a passo está no [GUIA_DE_DESENVOLVIMENTO.md, item 4, opção B](../GUIA_DE_DESENVOLVIMENTO.md#4-configurar-o-banco), e o endereço que o app deve usar está no [item 5](../GUIA_DE_DESENVOLVIMENTO.md#5-configurar-as-variáveis-de-ambiente-do-app).

No Supabase local a confirmação de e-mail vem desligada (`supabase/config.toml`), então dá para criar contas novas sem receber e-mail.

Se você estiver testando com um projeto Supabase na nuvem, não haverá contas de demonstração: crie as contas pelo próprio app (cenário M01), sempre com e-mails fictícios que você controle.

**2. Contas de demonstração** (criadas pelo seed; pessoas e e-mails **fictícios**, o domínio `.test` nunca recebe e-mail de verdade):

| Pessoa | E-mail | Papel na agenda "Casa (demonstração)" |
|---|---|---|
| Ana Demo | `ana.demo@exemplo.test` | Proprietária |
| Bruno Demo | `bruno.demo@exemplo.test` | Editor |
| Carla Demo | `carla.demo@exemplo.test` | Colaboradora |
| Davi Demo | `davi.demo@exemplo.test` | Visualizador |

Senha de todas: `Demo@2026!` (escrita no próprio `seed.sql`; vale só para este banco local de demonstração).

Eventos que o seed cria na agenda "Casa (demonstração)": Consulta no dentista (passado, concluído), Cinema (amanhã, cancelado), Comprar presente (privado do Bruno), Jantar de aniversário (daqui a 3 dias, com comentários e lembretes), Consulta médica (da Carla, marcada como "Ocupado"), Academia (toda segunda, quarta e sexta, com uma quarta-feira cancelada) e Viagem para a praia (dia inteiro, daqui a 14 dias).

**3. Aparelhos.** Vários cenários precisam de **duas pessoas ao mesmo tempo**. Use dois aparelhos: dois celulares, ou um celular e um emulador Android, cada um logado com uma conta diferente. Neste roteiro, "Aparelho A" e "Aparelho B".

**4. Atualização entre aparelhos.** As mudanças costumam aparecer sozinhas em poucos segundos. Se não aparecerem, **puxe a lista para baixo** para atualizar.

### M01. Cadastro (criar usuário)

1. Abra o app pela primeira vez. Passe pela apresentação ("Próximo" ou "Pular", depois "Começar").
2. Na tela de boas-vindas, toque em **"Criar conta"**.
3. Preencha "Seu nome" (ex.: Teste Um), "E-mail" (ex.: `teste1@exemplo.test`), "Senha" e "Confirme a senha" com a mesma senha de pelo menos 8 caracteres, com letras e números.
4. Toque em **"Criar conta"**.
   - **Esperado:** o app entra direto na aba **Agenda** (no Supabase local). Se a confirmação de e-mail estiver ligada no servidor, aparece "Confirme seu e-mail" pedindo um código de 6 dígitos.
5. Vá na aba **Agendas**.
   - **Esperado:** existe a agenda **"Minha agenda"**, com "Seu papel: Proprietário".
6. **Testes de erro:** repita o cadastro com a senha `abc`.
   - **Esperado:** "A senha precisa ter pelo menos 8 caracteres." Com o mesmo e-mail do passo 3: "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha."

### M02. Login, logout e recuperação de acesso

1. Na tela de boas-vindas, toque em **"Já tenho conta"**.
2. Digite `ana.demo@exemplo.test` e uma senha **errada**. Toque em **"Entrar"**.
   - **Esperado:** "E-mail ou senha incorretos."
3. Erre a senha mais 4 vezes.
   - **Esperado:** o app pede para esperar ("Muitas tentativas. Aguarde ... segundos e tente de novo.") e o botão fica desativado durante a espera.
4. Depois da espera, entre com a senha `Demo@2026!`.
   - **Esperado:** abre a aba **Agenda** com os eventos da "Casa (demonstração)".
5. **Logout:** vá em **Perfil > Sair**.
   - **Esperado:** aparece "Sair da conta?" avisando que os dados do aparelho serão apagados. Confirme. O app volta para a tela de entrada.
6. **Recuperação:** em "Entrar", toque em **"Esqueci minha senha"**, digite o e-mail da conta criada em M01 e toque em **"Enviar código"**.
   - **Esperado:** o app pede o código e a nova senha. No Supabase local, o e-mail com o código aparece na caixa de e-mails de teste do Supabase local (o endereço dela é mostrado por `npx supabase status`). Digite o código e a nova senha e toque em **"Salvar"**: aparece "Senha alterada! Você já está conectado."
   - Em um projeto na nuvem **sem SMTP próprio**, o e-mail só chega para membros da equipe do projeto no Supabase (veja [SEGURANCA.md](../SEGURANCA.md#limitações-conhecidas)).

### M03. Criação de agenda

1. Entre como **Ana** no Aparelho A.
2. Na aba **Agendas**, toque no **"+"** do topo ("Nova agenda").
3. Em "Nome da agenda", digite `Viagem (teste)`. Escolha uma cor e, em "Tipo de agenda", escolha "Viagem".
4. Toque em **"Criar agenda"**.
   - **Esperado:** mensagem "Agenda criada!". A agenda aparece na lista com "Seu papel: Proprietário".
5. **Teste de erro:** tente criar outra agenda com o nome vazio.
   - **Esperado:** "Campo obrigatório." e nada é criado.

### M04. Envio de convite

1. Ainda como Ana, na aba **Agendas**, abra **"Viagem (teste)"**.
2. Toque em **"Convidar pessoas"**.
3. Em "Papel de quem entrar", escolha **Colaborador**. Em "Validade", **7 dias**. Em "Quantas pessoas podem usar", **1 pessoa**.
4. Toque em **"Gerar convite"**.
   - **Esperado:** aparece "Convite criado" com um código no formato `XXXX-XXXX-XXXX` e o aviso de que ele só aparece agora. Os botões "Copiar" e "Compartilhar" funcionam.
5. Anote o código. Volte uma tela.
   - **Esperado:** em "Convites desta agenda", o convite aparece como **"Pendente"**, com "Código terminado em ..." (o código inteiro não aparece mais).

### M05. Aceite, recusa e cancelamento de convite

1. No Aparelho B, entre com a conta criada em M01 (Teste Um).
2. Na aba **Agendas**, toque em **"Entrar com código de convite"**.
3. Digite o código de M04 e toque em **"Ver convite"**.
   - **Esperado:** "Você foi convidado(a)", com o nome da agenda, "Seu papel será: Colaborador", quem convidou e a validade.
4. Toque em **"Aceitar e entrar"**.
   - **Esperado:** "Tudo certo!" e "Agora você participa da agenda "Viagem (teste)" como Colaborador." O botão **"Abrir a agenda"** leva até ela.
5. **Uso único:** entre com **Carla** em outro aparelho (ou saia e entre de novo no Aparelho B) e tente usar o mesmo código.
   - **Esperado:** "Este convite já foi usado."
6. **Cancelamento (revogação):** como Ana, gere um convite novo e anote o código. Em "Convites desta agenda", toque em **"Cancelar convite"** ao lado dele e confirme. Tente usar esse código com Carla.
   - **Esperado:** "Este convite foi cancelado."
7. **Recusa:** como Ana, gere um convite **por e-mail** em "Convidar por e-mail (opcional)" para `carla.demo@exemplo.test`. Como Carla, vá em Agendas > **"Convites recebidos"** e toque em **"Recusar"**.
   - **Esperado:** o convite some da lista de Carla e ela não entra na agenda. Ana recebe um aviso de recusa na aba **Avisos**.

### M06. Criação de evento (e visualização em outro aparelho)

1. Aparelho A: Ana. Aparelho B: Teste Um (agora membro de "Viagem (teste)").
2. No Aparelho A, aba **Agenda**, toque no botão redondo **"+"** ("Novo evento").
3. Em "Agenda", escolha **"Viagem (teste)"**. Em "Título", digite `Reunião de roteiro`. Escolha uma data e os horários de início e término.
4. Toque em **"Salvar"**.
   - **Esperado:** "Evento criado." O evento aparece no dia escolhido.
5. **Teste de erro:** crie outro evento com término **antes** do início.
   - **Esperado:** "O término precisa ser depois do início." e nada é salvo.
6. **Outro aparelho:** no Aparelho B, abra a aba **Agenda** e vá até a data do evento.
   - **Esperado:** "Reunião de roteiro" aparece. Na aba **Avisos** do Aparelho B há um aviso do novo evento. No Aparelho A (quem criou) **não** há aviso.

### M07. Edição de evento (e receber a atualização)

1. No Aparelho A (Ana), toque em "Reunião de roteiro" e em **"Editar"**.
2. Mude o título para `Reunião de roteiro (editada)` e o horário de início. Toque em **"Salvar"**.
   - **Esperado:** "Evento atualizado." O evento mostra o novo título e horário.
3. No detalhe do evento, toque em **"Histórico do evento"**.
   - **Esperado:** aparece quem alterou e o que mudou (título, horário).
4. **Permissão:** entre como **Davi** (visualizador) e abra "Jantar de aniversário" na "Casa (demonstração)".
   - **Esperado:** "Você pode apenas visualizar este evento." e não há botão "Editar".
5. **Receber atualização:** no Aparelho B, abra o mesmo evento editado no passo 2.
   - **Esperado:** mostra o título e o horário novos.

### M08. Exclusão de evento

1. No Aparelho A (Ana), abra "Reunião de roteiro (editada)" e toque em **"Excluir"**.
   - **Esperado:** "Excluir evento?" com "O evento sai da agenda de todos os membros."
2. Toque em **"Excluir"** no diálogo.
   - **Esperado:** "Evento excluído." com o botão **"Desfazer"** por alguns segundos. O evento some da agenda.
3. Toque em **"Desfazer"** a tempo.
   - **Esperado:** o evento volta.
4. Exclua de novo, sem desfazer. Confira o Aparelho B.
   - **Esperado:** o evento sumiu também no Aparelho B.

### M09. Evento recorrente (editar só este, este e os próximos, todos)

Faça os passos nesta ordem, num evento novo.

1. Como Ana, crie o evento `Aula (teste)` na "Viagem (teste)", começando na próxima segunda-feira, das 19:00 às 20:00. Em **"Repetir"**, escolha **"Toda semana"**. Salve.
   - **Esperado:** o evento aparece em todas as segundas seguintes, com a etiqueta "Repete".
2. **Todas:** abra qualquer ocorrência, toque em **"Editar"**.
   - **Esperado:** aparece "Este evento se repete" com as opções "Somente esta ocorrência", "Esta e as próximas" e "Todas as ocorrências da série".
   Escolha **"Todas as ocorrências da série"**, mude o local para `Sala 1` e salve.
   - **Esperado:** todas as ocorrências mostram "Sala 1".
3. **Só esta:** abra a **2ª** ocorrência, "Editar" > **"Somente esta ocorrência"**, mude o horário para 20:00 às 21:00 e salve.
   - **Esperado:** só aquela data muda de horário; as outras continuam às 19:00. O detalhe da ocorrência alterada mostra "Ocorrência alterada".
4. **Esta e as próximas:** abra a **4ª** ocorrência, "Editar" > **"Esta e as próximas"**, mude o título para `Aula avançada (teste)` e salve.
   - **Esperado:** da 1ª à 3ª continuam "Aula (teste)"; da 4ª em diante viram "Aula avançada (teste)".
5. **Excluir só uma:** abra a 5ª ocorrência, toque em **"Excluir"** > **"Somente esta ocorrência"**.
   - **Esperado:** só aquela data some; as demais continuam.
6. **Conferir o seed:** na "Casa (demonstração)", olhe "Academia" nos próximos 7 dias.
   - **Esperado:** aparece segunda, quarta e sexta, **menos** na primeira quarta-feira a partir do dia em que o seed rodou (essa ocorrência foi cancelada pelo seed).

### M10. Lembrete

1. Como Ana, crie um evento que comece daqui a **10 minutos**.
2. Em **"Meus lembretes"**, marque **"5 minutos antes"**. Salve.
   - **Esperado:** na primeira vez, o Android (versão 13 ou mais nova) pede permissão para enviar notificações. Toque em **"Permitir"**.
3. Saia do app (botão de início do celular) e espere.
   - **Esperado:** 5 minutos antes do início chega uma notificação. Por padrão, na tela bloqueada ela pode dizer só "Você tem um compromisso" (configurável em Perfil > Notificações > "Mostrar detalhes na tela bloqueada").
4. Toque na notificação.
   - **Esperado:** o app abre no detalhe do evento.
5. **Lembrete é pessoal:** no Aparelho B (outro membro), abra o mesmo evento.
   - **Esperado:** os lembretes da Ana não aparecem como lembretes do Aparelho B; cada pessoa escolhe os seus.
6. **Permissão negada:** em Configurações do Android > Apps > SynCK > Notificações, desligue. No app, vá em **Perfil > Notificações**.
   - **Esperado:** "Permissão do sistema" mostra "Bloqueada (ative nas configurações do Android)" e o botão **"Permitir notificações"**, que leva às configurações do Android. Nenhum lembrete chega enquanto estiver bloqueado.

Os lembretes são **agendados no próprio celular**; não há envio pelo servidor nesta versão.

### M11. Uso offline e volta da internet

1. Como Ana no Aparelho A, ligue o **modo avião**.
   - **Esperado:** aparece a faixa "Sem internet. Você está vendo os dados guardados neste aparelho." e o ícone de nuvem do topo muda para "sem internet".
2. Navegue pela agenda.
   - **Esperado:** os eventos já carregados continuam aparecendo.
3. Crie o evento `Evento offline (teste)` e salve.
   - **Esperado:** "Salvo neste aparelho. Será enviado quando houver internet." O evento aparece com a etiqueta **"Aguardando envio"** e a faixa mostra "1 alteração(ões) aguardando envio".
4. Ainda offline, edite o local de outro evento já existente.
   - **Esperado:** também fica "Aguardando envio".
5. Feche o app por completo e abra de novo (ainda offline).
   - **Esperado:** as alterações continuam lá, nada se perdeu. Ações que dependem do servidor (ex.: aceitar convite) mostram "Esta ação precisa de internet. Conecte-se e tente de novo."
6. Desligue o modo avião.
   - **Esperado:** em alguns segundos as etiquetas "Aguardando envio" somem e a faixa desaparece.
7. Vá em **Perfil > Sincronização**.
   - **Esperado:** "Tudo sincronizado" e "Nenhuma alteração pendente."
8. No Aparelho B (membro da mesma agenda):
   - **Esperado:** "Evento offline (teste)" e a edição do passo 4 aparecem.

### M12. Conflito de edição

1. Aparelho A: **Ana**. Aparelho B: **Bruno** (editor; na "Casa (demonstração)" editores podem editar eventos de todos). Os dois abrem **"Jantar de aniversário"**.
2. No Aparelho A, ligue o **modo avião**. Edite o título para `Jantar (versão da Ana)` e salve.
3. No Aparelho B (com internet), edite o **título** do mesmo evento para `Jantar (versão do Bruno)` e salve.
4. No Aparelho A, desligue o modo avião.
   - **Esperado:** a alteração da Ana **não** é aplicada por cima. Em **Perfil > Sincronização**, ela aparece como **"Conflito"**, com o botão **"Resolver"**.
5. Toque em **"Resolver"**.
   - **Esperado:** tela "Conflito de edição" com "Outra pessoa alterou ... enquanto você também alterava. Escolha o que manter.", mostrando **"Sua versão"** e **"Versão atual (servidor)"**.
6. Toque em **"Manter a minha versão"**.
   - **Esperado:** "Conflito resolvido." Nos dois aparelhos o título fica `Jantar (versão da Ana)`.
7. **Campos diferentes (sem conflito):** repita, mas no Aparelho A mude só o **local** e no Aparelho B só o **título**.
   - **Esperado:** não aparece conflito; o evento fica com o local da Ana **e** o título do Bruno.
8. **Evento excluído por outra pessoa:** repita com A offline editando e B **excluindo** o evento.
   - **Esperado:** "Outra pessoa excluiu ... enquanto você o alterava.", com as opções **"Recriar o evento com as minhas alterações"** e **"Aceitar a exclusão"**.

### M13. Remoção de membro (e confirmação da perda de acesso)

1. Aparelho A: **Ana**. Aparelho B: **Davi**. Confirme que Davi vê a "Casa (demonstração)" e seus eventos.
2. No Aparelho A, abra **"Casa (demonstração)" > "Membros"** e toque em **Davi Demo**.
3. Toque em **"Remover da agenda"**.
   - **Esperado:** "Remover Davi Demo?" com "A pessoa perde o acesso imediatamente e deixa de receber avisos desta agenda."
4. Confirme.
   - **Esperado:** "Pessoa removida." Davi sai da lista de membros.
5. No Aparelho B (Davi), atualize a aba **Agendas**.
   - **Esperado:** a "Casa (demonstração)" **não aparece mais**.
6. Na aba **Agenda** do Davi.
   - **Esperado:** os eventos da "Casa (demonstração)" sumiram.
7. Na aba **Avisos** do Davi.
   - **Esperado:** há um aviso de que ele foi removido. Se ele tentar abrir um evento antigo (por exemplo, tocando num aviso anterior), aparece "Este evento não existe mais ou você não tem acesso a ele."
8. **Volta com novo convite (opcional):** Ana gera um convite e Davi aceita.
   - **Esperado:** Davi volta a ver a agenda.

### M14. Alteração de papel

1. Aparelho A: **Ana**. Aparelho B: **Carla** (colaboradora).
2. Como Carla, confirme que ela consegue criar um evento na "Casa (demonstração)".
3. Como Ana, abra **"Casa (demonstração)" > "Membros" > Carla Demo**. Em **"Alterar papel"**, escolha **"Visualizador"**.
   - **Esperado:** "Papel alterado." e Carla aparece como Visualizador.
4. No Aparelho B (Carla), atualize e toque em **"+"**.
   - **Esperado:** a "Casa (demonstração)" **não aparece** na lista "Agenda" do formulário. Ao abrir um evento dessa agenda: "Você pode apenas visualizar este evento."
5. **Limite de quem gerencia:** entre como **Bruno** (editor) e abra **Membros > Carla Demo**.
   - **Esperado:** "Você não pode alterar esta pessoa." e não há opção de mudar papel.
6. Volte o papel da Carla para **Colaborador** para não atrapalhar outros testes.

### M15. Privacidade e busca (complementar)

1. Entre como **Davi** e use a **busca** (lupa no topo da aba Agenda) com o termo `presente`.
   - **Esperado:** "Comprar presente" (evento privado do Bruno) **não aparece**.
2. Entre como **Bruno** e busque `presente`.
   - **Esperado:** aparece.
3. Como **Davi**, olhe o dia da "Consulta médica" da Carla.
   - **Esperado:** aparece apenas **"Ocupado"**, sem título, local ou descrição.

### Registro dos resultados

Copie esta tabela para cada rodada de testes.

| Cenário | Data | Aparelho e versão do Android | Servidor (local ou nuvem) | Passou? | Observação |
|---|---|---|---|---|---|
| M01 | | | | | |
| M02 | | | | | |
| ... | | | | | |

### Testes do app da versão 3.0

| Arquivo | O que cobre |
|---|---|
| `utils/__tests__/tasks.test.ts` | Atraso, prazo em texto, visões (Hoje, Próximos 7 dias, Atrasadas...), filtros, ordenações e posição entre itens |
| `utils/__tests__/taskRecurrence.test.ts` | Próxima data de tarefas que se repetem, com os mesmos 24 casos do banco (`supabase/tests/fixtures/proxima-data.json`) |
| `utils/__tests__/quickAdd.test.ts` | Adição rápida em português: dias, horários, repetições, etiquetas, prioridade e quando pedir para conferir |
| `utils/__tests__/planning.test.ts` | Horários livres, horário em comum, planejar a semana, grade de horários, "O que você pretende fazer hoje?" e resumo da semana |
| `utils/__tests__/ics.test.ts` | Exportar e importar .ics: fusos, dia inteiro, repetição, exclusões, linhas longas e o que não é suportado |
| `utils/__tests__/search.test.ts` | Busca sem acento, por etiqueta, concluídas e atrasadas |
| `offline/__tests__/itemOverlay.test.ts` | Tarefas, listas, anotações, hábitos e plano do dia sem internet; mesclagem de conflitos |
| `services/__tests__/taskAlerts.test.ts` | Quando cada alerta de tarefa toca, limite de agendamentos e o adiamento que não some na sincronização |

## Relação com os critérios de aceitação

| Critério | Evidência automática | Evidência manual |
|---|---|---|
| Testes principais passarem | 92 testes do banco, 190 do app, 9 de tela e 7 da versão instalável passando (resumo no topo) | |
| Permissões funcionarem | `02`, `03`, `04`, `06` e `permissions.test.ts` | M07 (passo 4), M14 |
| Usuário removido perder acesso | `02_agendas_membros.test.mjs`, `07_avisos_lgpd.test.mjs` | M13 |
| Eventos recorrentes conforme escopo | `recurrence.test.ts`, `05_sincronizacao.test.mjs` | M09 |
| Lembretes conforme escopo | `04_eventos.test.mjs` (lembretes pessoais), `reminders.test.ts` | M10 |
| Filtros funcionarem | `filters.test.ts` | Ainda sem cenário manual próprio |
| Busca respeitar permissões | `06_privacidade_busca.test.mjs`, `filters.test.ts` | M15 |
| Modo offline não perder alterações | `outbox.test.ts` | M11 |
| Sincronização lidar com reconexão | `outbox.test.ts` (nova tentativa, app fechado durante envio), `05_sincronizacao.test.mjs` | M11 |
| Conflitos detectados ou tratados | `05_sincronizacao.test.mjs`, `outbox.test.ts` | M12 |
| Dados privados não vazarem | `01`, `06`, `07`, `08` | M15 |
| Mensagens de erro compreensíveis | `errors.test.ts` | Passos de erro em M01, M02, M03, M05, M06 |

Os 10 cenários de aceite da versão 3.0.0, com o que está aprovado e o que ainda depende do aparelho, estão em [VALIDACAO_3.0.md](VALIDACAO_3.0.md), com os roteiros A (um Android), B (duas pessoas) e C (iPhone ou computador).

## Limitações conhecidas

- **Testes de tela só na versão web.** No Android (emulador ou celular) as telas são verificadas pelo roteiro manual. O "Supabase de mentira" imita o Auth e o PostgREST de forma simplificada; o tempo real (Realtime) não é testado.
- **O roteiro manual ainda não foi executado** em celular físico com servidor real. Não há registro de resultado até agora.
- **Supabase Auth não é testado automaticamente** (login, logout, recuperação, e-mail).
- **Lembretes no Android:** o cálculo de quais lembretes agendar é testado, mas o agendamento e a entrega pelo sistema (`expo-notifications`) não têm teste automático.
- **Motor de sincronização completo** (`syncEngine.ts`) e serviços de rede do app não têm teste automático; só as partes puras (fila e mesclagem).
- **Acessibilidade** não tem teste automático; veja o roteiro próprio em [ACESSIBILIDADE.md](ACESSIBILIDADE.md).
- Os testes do banco usam uma **simulação mínima** do Supabase (`supabase-shim.sql`). Diferenças de configuração do projeto real (painel, Auth, limites de requisição do Supabase) não são cobertas.
