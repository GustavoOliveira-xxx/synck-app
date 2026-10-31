# Registro de decisões

Cada decisão segue o formato: **contexto**, **opções**, **decisão**, **motivo** e **consequências**. Quando uma decisão mudar, ela não é apagada: uma nova entrada é criada dizendo qual substitui.

Índice:
- [D01 Stack mobile](#d01-stack-mobile)
- [D02 Backend](#d02-backend)
- [D03 TypeScript](#d03-typescript)
- [D04 Navegação com Expo Router](#d04-navegação-com-expo-router)
- [D05 Onde ficam as permissões](#d05-onde-ficam-as-permissões)
- [D06 Datas e fusos horários](#d06-datas-e-fusos-horários)
- [D07 Recorrência](#d07-recorrência)
- [D08 Offline, fila e conflitos](#d08-offline-fila-e-conflitos)
- [D09 Lembretes e notificações](#d09-lembretes-e-notificações)
- [D10 Convites](#d10-convites)
- [D11 Privacidade de eventos](#d11-privacidade-de-eventos)
- [D12 Exclusão lógica e lixeira](#d12-exclusão-lógica-e-lixeira)
- [D13 Armazenamento seguro da sessão](#d13-armazenamento-seguro-da-sessão)
- [D14 Geração do APK](#d14-geração-do-apk)
- [D15 Estado global](#d15-estado-global)
- [D16 Tabelas planejadas que foram adaptadas](#d16-tabelas-planejadas-que-foram-adaptadas)
- [D17 E-mail e confirmação de conta](#d17-e-mail-e-confirmação-de-conta)
- [D18 Autoria, licença e repositório](#d18-autoria-licença-e-repositório)
- [D19 Agenda pessoal criada no cadastro](#d19-agenda-pessoal-criada-no-cadastro)
- [D20 Testes do banco com PGlite](#d20-testes-do-banco-com-pglite)
- [D21 APK só para processadores ARM](#d21-apk-só-para-processadores-arm)
- [D22 Lista fechada de permissões do Android](#d22-lista-fechada-de-permissões-do-android)
- [D23 Testes de tela na versão web, contra o banco real](#d23-testes-de-tela-na-versão-web-contra-o-banco-real)
- [D24 Versão web instalável para iPhone e computadores](#d24-versão-web-instalável-para-iphone-e-computadores)
- [D25 Layout responsivo](#d25-layout-responsivo)
- [D26 Identidade SynCK](#d26-identidade-synck)
- [D27 Notificações no navegador (Web Push)](#d27-notificações-no-navegador-web-push)
- [D28 Entrar com Google](#d28-entrar-com-google)
- [D29 Auditoria antes de evoluir](#d29-auditoria-antes-de-evoluir)
- [D30 Tarefas e lembretes numa tabela própria](#d30-tarefas-e-lembretes-numa-tabela-própria)
- [D31 Escrita das novas entidades só por função](#d31-escrita-das-novas-entidades-só-por-função)
- [D32 Recorrência de tarefas](#d32-recorrência-de-tarefas)
- [D33 Subtarefas e conclusão da tarefa](#d33-subtarefas-e-conclusão-da-tarefa)
- [D34 "O que você pretende fazer hoje?" e Meu dia](#d34-o-que-você-pretende-fazer-hoje-e-meu-dia)
- [D35 Blocos de tempo e planejador](#d35-blocos-de-tempo-e-planejador)
- [D36 Disponibilidade e enquetes de horário](#d36-disponibilidade-e-enquetes-de-horário)
- [D37 Adição rápida sem inteligência artificial](#d37-adição-rápida-sem-inteligência-artificial)
- [D38 Arquivos .ics](#d38-arquivos-ics)
- [D39 Animações no navegador](#d39-animações-no-navegador)

---

## D01 Stack mobile

**Contexto.** O proprietário conhece HTML, CSS, JavaScript e MySQL. Prioridade Android, iOS depois.

**Opções avaliadas.**

| Critério | React Native + Expo | Flutter | PWA (site instalável) |
|---|---|---|---|
| Linguagem | JavaScript/TypeScript (já conhecida) | Dart (nova) | JavaScript |
| Curva de aprendizado | Baixa para quem sabe JS | Média/alta | Baixa |
| Recursos nativos (notificações, armazenamento seguro) | Completos via módulos Expo | Completos | Limitados |
| Notificações | Locais e push | Locais e push | Push na web é limitado e inconsistente no Android, ausente em muitos cenários |
| Funcionamento offline | Completo | Completo | Possível com Service Worker, mas mais frágil |
| Instalação no celular | APK ou Play Store | APK ou Play Store | "Adicionar à tela inicial", sem loja |
| Geração de APK | Grátis (Gradle no GitHub Actions) ou EAS | Grátis (Gradle) | Não se aplica |
| Expo Application Services (EAS) | Opcional (build na nuvem, atualizações) | Não se aplica | Não se aplica |
| Dependência de serviços externos | Nenhuma obrigatória | Nenhuma | Nenhuma |
| Limitações da abordagem gerenciada | Pastas nativas são geradas (`prebuild`); código nativo próprio exige "development build" | Não se aplica | Não se aplica |
| Migrar para nativo depois | Possível (`expo prebuild` gera projeto Android/iOS editável) | Não se aplica | Reescrita |
| Comunidade e documentação | Muito grandes | Grandes | Grandes |
| Aparência de aplicativo | Nativa | Nativa | Próxima, mas é um site |

**Decisão.** React Native com Expo (SDK 58).

**Motivo.** Melhor equilíbrio entre o que você já sabe (JavaScript), recursos nativos completos, geração gratuita de APK e caminho aberto para iOS. Flutter exigiria aprender Dart. A PWA não oferece notificações confiáveis no Android nem armazenamento seguro de credenciais.

**Consequências.** As pastas `android/` e `ios/` não ficam no repositório: são geradas a partir de `app.json` (Continuous Native Generation). Bibliotecas com código nativo exigem novo build do APK (não funcionam no aplicativo Expo Go sem isso).

## D02 Backend

**Contexto.** Precisa de autenticação, banco relacional, regras de autorização, tempo real e custo zero no início, mantido por um iniciante.

**Opções avaliadas.**

| Critério | Supabase | Firebase | API própria (Node + MySQL) |
|---|---|---|---|
| Autenticação | Pronta (e-mail/senha, OTP, Google, Apple) | Pronta | Fazer do zero (hash, tokens, renovação, recuperação) |
| Banco | PostgreSQL (SQL, relacional) | Firestore (NoSQL, documentos) | MySQL |
| Regras de autorização | Row Level Security em SQL, no banco | Security Rules (linguagem própria) | Middlewares escritos à mão |
| Notificações | Não envia push (integra com Expo/FCM) | FCM integrado | Integrar FCM |
| Arquivos | Storage com regras | Storage com regras | Integrar S3 ou similar |
| Tempo real | Realtime (respeita RLS) | Nativo | Fazer com WebSocket |
| Custo inicial | Plano gratuito | Plano gratuito | Hospedagem (geralmente paga após período grátis) |
| Limites do gratuito | 2 projetos ativos, pausa após 7 dias sem uso, banco pequeno | Cotas de leitura/escrita | Depende da hospedagem |
| Facilidade para iniciante | Alta (painel web, SQL familiar) | Média (modelo NoSQL) | Baixa (muita coisa para manter) |
| Migração futura | Fácil: é Postgres padrão, `pg_dump` | Difícil (formato próprio) | Não se aplica |

**Custos qualitativos da API própria:** precisaria de hospedagem do servidor Node, banco MySQL gerenciado, serviço de e-mail, serviço de push e monitoramento. Credenciais: senha do banco, segredo de assinatura de tokens, chave do serviço de e-mail, chave do FCM. Backup por `mysqldump` agendado; deploy por Docker ou plataforma (Render, Railway, Fly); rollback por versão anterior da imagem; monitoramento por Sentry ou similar. É bem mais trabalho para manter sozinho.

**Decisão.** Supabase.

**Motivo.** Entrega autenticação segura, banco SQL e regras de acesso no próprio banco, sem servidor para manter. O SQL do Postgres é muito parecido com o MySQL.

**Como evitar dependência excessiva.**
1. Todo o banco é SQL padrão versionado em `supabase/migrations/`.
2. As regras de negócio críticas ficam em funções SQL (`public.accept_invitation`, `public.apply_event_op`, etc.), que poderiam ser chamadas por uma API própria no futuro.
3. O app só fala com o backend por `app-mobile/src/services/`. Trocar de backend significa reescrever essa pasta.
4. O que é específico do Supabase (`auth.uid()`, `auth.users`, publicação `supabase_realtime`) está isolado e documentado em [MODELO_DE_DADOS.md](MODELO_DE_DADOS.md).

## D03 TypeScript

**Decisão.** Usar TypeScript no app e JavaScript simples (módulos `.mjs`) nos testes do banco.

**Motivo.** TypeScript é JavaScript com "etiquetas" de tipo. Exemplo: se uma função espera uma data e você passa um número, o editor sublinha em vermelho antes de rodar. Isso evita uma categoria inteira de erros, o que importa muito em datas, permissões e sincronização.

## D04 Navegação com Expo Router

**Decisão.** Expo Router (padrão atual do Expo). As rotas ficam em `src/app/` e são finas: cada arquivo só aponta para a tela real em `src/screens/`.

**Motivo.** Funciona como páginas de um site (cada arquivo é um endereço), o que é intuitivo para quem vem de HTML. Separar rota e tela mantém a organização em `screens/` e `navigation/`.

## D05 Onde ficam as permissões

**Decisão.** Toda autorização é verificada **no banco**, com Row Level Security (RLS) e funções `SECURITY DEFINER` que conferem o papel de quem chama. O app também esconde botões que a pessoa não pode usar, mas isso é só conforto visual.

**Motivo.** Regras 8, 9 e 13 de [REGRAS_DE_NEGOCIO.md](REGRAS_DE_NEGOCIO.md): o backend precisa recusar alterações não autorizadas mesmo que o cliente seja modificado.

**Consequências.** Inserir membros diretamente na tabela é proibido; só funções como `accept_invitation` conseguem. Isso também impede adicionar alguém "em silêncio" (regra 8 dos convites).

## D06 Datas e fusos horários

**Decisão.**
- Eventos com horário: início e fim guardados como `timestamptz` (instante absoluto, em UTC) **mais** o fuso IANA do evento (ex.: `America/Sao_Paulo`).
- Eventos de dia inteiro: guardados como datas locais (`start_date`, `end_date`, tipo `date`, sem fuso). Os campos `starts_at`/`ends_at` também são preenchidos, apenas para buscas por período.
- O aparelho converte para o fuso de exibição escolhido pela pessoa (padrão: fuso do aparelho).

**Motivo.** Um instante em UTC nunca é ambíguo. O fuso do evento permite recalcular repetições corretamente no horário de verão. Datas sem horário guardadas como data local evitam o clássico "aniversário aparece no dia anterior".

**Consequências.** Viajar não muda eventos com horário (eles aparecem na hora local do destino); eventos de dia inteiro continuam no mesmo dia em qualquer fuso. Detalhes e exemplos em [ARQUITETURA.md](ARQUITETURA.md#datas-e-fusos-horários).

## D07 Recorrência

**Decisão.** Guardar a **regra** (`recurrence_rule`, no padrão RRULE da RFC 5545, subconjunto suportado) no evento e as **exceções** (`recurrence_exceptions`, chaveadas pela data local da ocorrência). Ocorrências são **virtuais**: calculadas no aparelho só dentro da janela que está na tela.

**Opções.** (a) gerar todas as ocorrências no banco; (b) regra + ocorrências virtuais + exceções; (c) materialização sob demanda.

**Motivo.** A opção (b) não cria infinitas linhas no banco, é o padrão usado por Google Calendar e pelo formato ICS (facilita exportar no futuro) e funciona offline.

**Detalhes.**
- Suportado: diário, semanal, quinzenal (semanal a cada 2), mensal, anual, dias da semana específicos, intervalo, data final, quantidade, sem fim.
- Mensal no dia 31: segue a RFC 5545, ou seja, **só ocorre nos meses que têm dia 31** (mesmo comportamento do Google Calendar). Anual em 29/02: só em anos bissextos.
- "Só esta": cria exceção. "Esta e as próximas": a série original termina no dia anterior e uma nova série começa (operação atômica no servidor). "Todas": altera a regra base, preservando exceções.
- Exceções são chaveadas pela **data local** da ocorrência original, porque a menor frequência suportada é diária (no máximo uma ocorrência por dia). Assim, mudar o horário da série não "perde" as exceções.

## D08 Offline, fila e conflitos

**Decisão.**
- Leitura offline: cache local (AsyncStorage) de agendas, membros e eventos já sincronizados.
- Escrita de eventos: **sempre** passa por uma fila local (outbox), mesmo online. Se houver internet, a fila é enviada na hora.
- Cada operação tem `id` único (UUID), data local, tipo, entidade, payload, status, tentativas, erro e data da última tentativa.
- O servidor registra cada `id` de operação processado (`sync_operations`). Reenvio da mesma operação devolve o mesmo resultado, sem duplicar (regra 17).
- Eventos novos já nascem com ID gerado no aparelho, então reenviar uma criação não cria duplicata.
- Conflitos: cada evento tem `version`. A edição envia a versão em que se baseou. Se o servidor tiver outra versão:
  1. o app tenta **mesclar** (se você mudou o local e a outra pessoa mudou o título, os dois ficam);
  2. se os mesmos campos foram alterados, o app **pergunta** qual manter.

**Por que não "a última gravação vence".** Ela apaga silenciosamente o trabalho de outra pessoa. Exemplo: você muda o horário offline; sua namorada muda o local online; quando você reconecta, "última vence" perderia o local novo. Com versão e mesclagem, os dois campos são preservados.

**Ações que exigem internet** (convites, membros, papéis, exclusão de conta, exportação) não entram na fila: o app avisa que precisa de conexão (regra 23).

## D09 Lembretes e notificações

**Decisão (V1).**
- **Lembretes**: notificações **locais**, agendadas no próprio aparelho com `expo-notifications`. Funcionam offline e não precisam de Firebase.
- **Avisos de colaboração** (convite aceito, evento alterado, membro removido, comentário): gravados no banco por gatilhos (triggers) e mostrados na **central de avisos** do app, em tempo real quando o app está aberto.
- **Push remoto** (aviso com o app fechado): fica para a próxima versão, porque exige projeto Firebase, credencial FCM e uma função no servidor. A tabela `devices` já guarda o campo `push_token` para isso.

**Tratamentos.** Reagendamento completo a cada sincronização (cancela e recria) evita duplicidade e cobre evento alterado, cancelado, série recorrente, troca de fuso e troca de aparelho. Horário de silêncio e "mostrar detalhes na tela bloqueada" são respeitados. Por padrão a notificação mostra só "Você tem um compromisso" (privacidade).

## D10 Convites

**Decisão.**
- Código aleatório gerado **no servidor** (60 bits, formato `XXXX-XXXX-XXXX`, sem letras ambíguas).
- No banco fica só o **hash SHA-256** do código (regra 35: nada de autenticação em texto puro). O código aparece uma única vez, para ser compartilhado. Perdeu? Cancele e gere outro.
- Prévia antes de aceitar: nome da agenda, cor, papel e quem convidou (regras 3 e 4).
- Limite de tentativas: 10 códigos errados em 15 minutos bloqueiam novas tentativas temporariamente.
- Convite para um e-mail substitui um convite pendente anterior para o mesmo e-mail (evita duplicados, regra 7).
- Convite por e-mail só pode ser aceito por conta com e-mail **confirmado**.

## D11 Privacidade de eventos

| Nível | Quem vê tudo | Quem vê só "Ocupado" |
|---|---|---|
| `members` (padrão) | Todos os membros ativos | Ninguém |
| `participants` | Criador, participantes escolhidos, proprietário e administradores | Ninguém (os demais não veem) |
| `private` | Só o criador (quando a agenda permite eventos privados) | Ninguém |
| `busy` | Criador, proprietário e administradores | Demais membros veem título "Ocupado" e horário |

Regra 29 (criador não esconde evento de quem administra, salvo regra explícita): a "regra explícita" é a configuração da agenda **Permitir eventos privados**, ligada por padrão e desligável pelo proprietário.

## D12 Exclusão lógica e lixeira

**Decisão.** Eventos e agendas excluídos ganham `deleted_at` e somem das telas. Agendas ficam 30 dias na lixeira e podem ser restauradas pelo proprietário. Eventos podem ser restaurados por quem pode editá-los. A exclusão definitiva é feita pela função `public.purge_trash()`, que pode ser agendada no Supabase (pg_cron) ou executada manualmente.

## D13 Armazenamento seguro da sessão

**Decisão.** Tokens no `expo-secure-store` (Android Keystore), divididos em pedaços, porque a sessão do Supabase pode passar de 2 KB (limite recomendado por valor). No navegador (usado só para testes), cai para `localStorage`.

## D14 Geração do APK

**Opções.** EAS Build (nuvem da Expo, exige conta e token), build local com Android Studio (exige computador potente e muita configuração), ou GitHub Actions com Gradle.

**Decisão.** GitHub Actions com Gradle (`expo prebuild` + `./gradlew assembleRelease bundleRelease`).

**Motivo.** Grátis, não exige conta extra, não exige Android Studio. O APK fica disponível para download na aba Actions e, ao rodar o workflow manualmente, também na página **Releases**, com link direto para baixar no celular.

**Assinatura.** Sem segredos configurados, o APK é assinado com a chave de debug do template (boa para testes, **não** para distribuição ampla). Com os segredos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`, o workflow assina com a sua chave. Passo a passo em [GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md).

## D15 Estado global

**Decisão.** `zustand` (biblioteca pequena de estado global) + cache próprio.

**Motivo.** Menos conceitos que Redux, sem "mágica". Cada store é um arquivo simples com dados e funções.

## D16 Tabelas planejadas que foram adaptadas

| Tabela planejada | O que foi feito | Por quê |
|---|---|---|
| `users` | Usa `auth.users` do Supabase | Senhas com hash bcrypt, confirmação e recuperação prontas |
| `sessions` | Usa `auth.sessions` do Supabase | O Supabase já controla sessões e revogação |
| `event_recurrences` | Virou a coluna `events.recurrence_rule` | Relação 1 para 1; RRULE é padrão de mercado |
| `attachments` | Não criada na V1 | Anexos estão fora do escopo; o desenho está no [ROADMAP.md](ROADMAP.md) |
| `deleted_records` | Não criada | Exclusão lógica (`deleted_at`) e sincronização por janela completa já cobrem; seria necessária só em sincronização incremental |
| Demais | Criadas como planejado | Ver [MODELO_DE_DADOS.md](MODELO_DE_DADOS.md) |

## D17 E-mail e confirmação de conta

**Contexto.** Desde 2024 o servidor de e-mail gratuito do Supabase só envia mensagens para endereços da equipe do projeto e tem limite baixo por hora.

**Decisão.** O app suporta os dois modos:
- confirmação **desligada**: cadastro entra direto (recomendado para começar com poucas pessoas conhecidas);
- confirmação **ligada** com SMTP próprio (ex.: Resend, gratuito para volume baixo): o app pede o código de 6 dígitos.

Recuperação de senha também usa código de 6 dígitos digitado no app (evita configurar links profundos). Os modelos de e-mail precisam conter `{{ .Token }}`; passo a passo no [GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md).

**Consequência.** Sem SMTP próprio, a recuperação de senha só chega para e-mails da equipe do Supabase. Documentado em [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## D18 Autoria, licença e repositório

- Autor: **Gustavo Oliveira dos Santos**, e-mail de commits informado pelo proprietário.
- Repositório: `GustavoOliveira-xxx/synck-app` (já existente).
- Licença: **MIT**.

## D19 Agenda pessoal criada no cadastro

**Decisão.** Ao criar a conta, o banco cria automaticamente a agenda "Minha agenda" (tipo pessoal).

**Motivo.** A pessoa já começa com um lugar para criar eventos, sem tela vazia e sem passo extra.

## D20 Testes do banco com PGlite

**Decisão.** Testar migrations, RLS e funções com PGlite (PostgreSQL real compilado para WebAssembly, roda dentro do Node), simulando o `auth.uid()` do Supabase.

**Motivo.** Permite testar permissões de verdade (usuário A não vê dados de B, visualizador não edita, removido perde acesso) sem Docker e sem acessar o projeto de produção. Roda no GitHub Actions em segundos.

**Limitação.** O PGlite não é idêntico ao Supabase hospedado (não tem o serviço de Auth, o Realtime nem as extensões do provedor). Por isso o guia de deploy pede que, depois de aplicar as migrations no projeto real, se rode o verificador de segurança do painel (Advisors).

## D21 APK só para processadores ARM

**Decisão.** O APK e o AAB são compilados apenas para `armeabi-v7a` e `arm64-v8a`.

**Motivo.** O primeiro build com as 4 arquiteturas gerou um APK de 92 MB. Praticamente todos os celulares Android usam ARM; x86/x86_64 servem quase só para emuladores. Cortar as duas reduz o download e o tempo de build.

**Consequência.** O APK não instala em emulador x86 do Android Studio. Quem desenvolve pode rodar com `npx expo run:android`, que compila para a arquitetura do emulador.

## D22 Lista fechada de permissões do Android

**Decisão.** Bibliotecas trazem permissões que o app não usa (contadores de ícone de várias marcas, biometria, push do Google, rastreio de instalação). Todas foram bloqueadas em `app.json` (`blockedPermissions`) e o workflow **Gerar APK Android** falha se aparecer qualquer permissão fora desta lista:

| Permissão | Por que o app precisa | Aparece para a pessoa? |
|---|---|---|
| INTERNET | Falar com o servidor | Não |
| ACCESS_NETWORK_STATE | Saber se está online ou offline | Não |
| ACCESS_WIFI_STATE | Exigida pela biblioteca de estado da rede | Não |
| POST_NOTIFICATIONS | Mostrar lembretes (Android 13 ou mais novo) | Sim, uma vez |
| RECEIVE_BOOT_COMPLETED | Reagendar lembretes depois que o celular reinicia | Não |
| VIBRATE | Vibrar no lembrete | Não |
| WAKE_LOCK | Entregar o lembrete com a tela apagada | Não |
| DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION | Interna do Android, protege o próprio app | Não |
| FOREGROUND_SERVICE | Exigida pelo WorkManager do Android, que redesenha os widgets da tela inicial em segundo plano (3.3.0). Sem ela, a atualização dos widgets pode falhar no Android 11 ou mais antigo. O app não inicia serviço em primeiro plano por conta própria | Não |

**Motivo.** O app não deve pedir permissões desnecessárias. A checagem automática impede que uma atualização de biblioteca traga uma permissão nova sem ninguém perceber.

## D23 Testes de tela na versão web, contra o banco real

**Alternativas.** (a) Detox ou Maestro com emulador Android no GitHub Actions; (b) testes de componentes isolados; (c) abrir a versão web do app num navegador com tamanho de celular e imitar só a camada HTTP do Supabase, usando o banco real em PGlite.

**Decisão.** (c), na pasta `e2e/`, com Playwright (`playwright-core`) e o Chrome que já vem nas máquinas do GitHub.

**Motivo.** Roda em cerca de 2 minutos sem emulador, usa o mesmo código das telas do APK e as mesmas regras de acesso do banco (migrations e seed reais). Pegou um problema real na primeira execução: a tela de detalhes do evento não mostrava a data.

**Limitações.** Não exercita o Android nativo (seletores de data, notificações, armazenamento seguro), o Supabase Auth real nem o tempo real. Esses pontos seguem no roteiro manual de [docs/TESTES.md](docs/TESTES.md). Emulador Android no CI fica no [ROADMAP.md](ROADMAP.md).

## D24 Versão web instalável para iPhone e computadores

**Pergunta do proprietário.** "Pra iPhone, como faço? Se não tiver como, deixe o app responsivo pra todo tipo de sistema operacional."

**Alternativas.**

| Alternativa | Custo | Prós | Contras |
|---|---|---|---|
| (a) App nativo na App Store (EAS Build + TestFlight) | Anuidade da Apple (US$ 99) | Experiência nativa, lembretes que tocam | Exige conta paga; análise da Apple; não pôde ser testado aqui |
| (b) Expo Go no iPhone | Gratuito | Rápido para quem desenvolve | Só funciona com o computador de quem programa ligado; não serve para usuários |
| (c) **Versão web instalável (PWA)** no GitHub Pages | Gratuito | Mesmo código; iPhone, iPad, Android e computador; ícone na tela de início; abre sem internet; atualiza sozinha | Lembretes não tocam; sessão no armazenamento do navegador |

**Decisão.** (c) agora, com o caminho de (a) documentado ([GUIA_DE_DEPLOY.md, parte 7](GUIA_DE_DEPLOY.md#parte-7-app-nativo-para-iphone-app-store)) para quando o proprietário quiser pagar a Apple.

**Como funciona.**

- `app-mobile/public/`: modelo da página com as marcações do iPhone, manifesto, ícones e um *service worker* que guarda os arquivos do app no aparelho. O endereço base é descoberto pelo próprio script do app, então o site funciona na raiz ou numa subpasta.
- `app-mobile/app.config.js`: só ao gerar o site, define a subpasta (`SITE_BASE_PATH`), necessária no GitHub Pages (`/synck-app`).
- Workflow **Publicar versão web**: gera o site, copia o `index.html` para `404.html` (links diretos), testa a instalação e o modo offline (`e2e/site.test.mjs`) e publica se o Pages estiver ligado. Com domínio próprio, publica na raiz.
- No navegador, o app usa o seletor de data e hora do próprio navegador, copia o texto quando não há folha de compartilhamento e baixa um arquivo na exportação de dados.

**Lembretes na web.** Exigiriam Web Push (servidor de envio, chaves VAPID, agendamento no Supabase). Ficou no [ROADMAP.md](ROADMAP.md); o app avisa na tela de lembretes e nas configurações de notificação que, no navegador, eles não tocam.

## D25 Layout responsivo

**Decisão.** Três faixas de largura em `app-mobile/src/utils/layout.ts` (testadas):

| Largura | Faixa | Layout |
|---|---|---|
| Menos de 600 | Celular | Abas embaixo, uma coluna, listas de opções sobem de baixo |
| 600 a 767 | Celular deitado, tablet pequeno | Abas embaixo, conteúdo centralizado, diálogos no centro |
| 768 a 1023 | Tablet | Menu lateral, conteúdo centralizado |
| 1024 ou mais | Computador, tablet grande deitado | Menu lateral, mês e eventos do dia lado a lado |

Formulários e listas têm largura máxima de 720 (leitura confortável) e diálogos, de 520. O app passou a girar (retrato e paisagem) e a aceitar iPad.

**Motivo.** Um único código para todas as telas, sem telas duplicadas. Os testes de tela conferem os tamanhos de celular, tablet e computador.

## D26 Identidade SynCK

**Contexto.** Na versão 2.0.0 o app deixou de ser "Agenda Compartilhada" e virou **SynCK**, um produto CK Group.

**Decisão.** Cores, fontes, ícones e mascote ficam num só lugar (`app-mobile/src/theme/marca.ts` e `tokens.ts`). Telas usam só os tokens, nunca cores soltas. O nome do pacote Android e a assinatura do APK não mudaram, para quem já tinha o app atualizar por cima.

**Consequências.** Trocar a marca no futuro é mexer nesses arquivos e nos ícones de `assets/`. O repositório passou a se chamar `synck-app` e o site, `/synck-app`.

## D27 Notificações no navegador (Web Push)

**Contexto.** No iPhone e no computador o SynCK roda como site instalável (D24), e o navegador só mostra um aviso com o app fechado se um servidor mandar.

**Decisão.** A função `enviar-push` (Supabase Edge Function) é chamada a cada minuto pelo agendador do banco (`pg_cron`), mas só quando existe ao menos uma inscrição. As chaves VAPID nascem na primeira rodada e ficam em `private.web_push_config`, inacessível ao app. A lógica de datas e repetição é a mesma do app: o script `scripts/copiar-logica-push.mjs` copia os arquivos e o CI falha se a cópia estiver desatualizada.

**Consequências.** Nenhum serviço pago. No Android continuam as notificações locais do aparelho, que funcionam sem internet. A 3.0.0 acrescentou os alertas de tarefas e lembretes e o caminho certo ao tocar em avisos de tarefa e enquete.

## D28 Entrar com Google

**Decisão.** Login social pelo próprio Supabase Auth, aberto no navegador do sistema. O botão só aparece funcionando depois que o provedor é ligado no painel (GUIA_DE_DEPLOY.md, parte 9). Nenhuma chave do Google fica no app.

## D29 Auditoria antes de evoluir

**Contexto.** O pedido da 3.0.0 exigia não dar nada como pronto só porque a documentação dizia.

**Decisão.** Antes de qualquer mudança, a auditoria em [docs/AUDITORIA_3.0.md](docs/AUDITORIA_3.0.md) rodou todos os testes e comparou cada funcionalidade com o código. O resultado de cada cenário de aceite fica em [docs/VALIDACAO_3.0.md](docs/VALIDACAO_3.0.md), marcado como aprovado só quando há teste que o demonstre.

**Consequências.** A auditoria achou um defeito real (o lembrete adiado sumia na sincronização seguinte), corrigido na 3.0.0.

## D30 Tarefas e lembretes numa tabela própria

**Contexto.** Na 2.0 "tarefa" e "lembrete" eram só tipos de evento: exigiam início e fim e não tinham prazo sem horário, prioridade, subtarefas nem conclusão por ocorrência.

**Alternativas.** (a) Continuar como eventos com campos extras; (b) uma tabela para tarefas e outra para lembretes; (c) **uma tabela `tasks` com a coluna `item_type` (`task` ou `reminder`)**.

**Decisão.** (c). Tarefas e lembretes compartilham prazo, repetição, alertas, listas, sincronização e permissões; o que muda é a apresentação (o lembrete não tem subtarefas nem estimativa e aparece com caixa quadrada). Eventos continuam na tabela `events`.

**Compatibilidade.** Nada da 2.0 foi apagado nem convertido. Eventos antigos dos tipos tarefa e lembrete continuam eventos e abrem normalmente; esses tipos só saíram da lista ao criar evento novo (em produção não havia nenhum).

**Alertas.** A base do alerta é o prazo com horário; sem horário, 9h do dia do prazo. Cada pessoa escolhe os seus alertas (`task_alerts`), como nos eventos.

## D31 Escrita das novas entidades só por função

**Decisão.** Tarefas, lembretes, listas, anotações, hábitos e o plano do dia só mudam pela função `public.apply_item_op` (SECURITY DEFINER), que confere a permissão de cada operação e grava o histórico. O app tem apenas leitura direta (RLS de `select`) e nenhuma permissão de `insert`, `update` ou `delete` nessas tabelas.

**Motivo.** Regras que dependem de várias tabelas (quem pode concluir uma tarefa atribuída, quem pode mudar a lista, o que cada papel vê) ficam num lugar só e testável. Cada operação tem um identificador (`sync_operations`), então reenviar a mesma operação depois de uma queda de conexão não duplica nada.

**Privacidade.** Tarefa pessoal (sem agenda) só é vista pela dona, mesmo por quem divide outra agenda com ela. Tarefa numa agenda segue a privacidade escolhida: todos os membros, só participantes ou privada.

## D32 Recorrência de tarefas

**Alternativas.** (a) Gerar as próximas ocorrências como linhas; (b) **guardar só a próxima data e registrar cada conclusão**.

**Decisão.** (b). A tarefa guarda o próximo prazo (`due_date`). Concluir grava uma linha em `task_completions` (única por tarefa e data) e avança o prazo. Dois modos:

- **pelo calendário** ("todo dia 5", "toda segunda"): a próxima data segue a regra, mesmo concluindo atrasado;
- **depois da conclusão** ("3 dias depois de concluir"): conta a partir do dia em que foi concluída.

**Mesmo resultado no app e no banco.** O cálculo existe em TypeScript (`utils/taskRecurrence.ts`) e em SQL (`private.rrule_next`). Os dois são testados com os mesmos 24 casos de `supabase/tests/fixtures/proxima-data.json`.

**Consequências.** Concluir a mesma ocorrência em dois aparelhos avança o prazo uma vez só. Reabrir uma ocorrência devolve o prazo para ela.

## D33 Subtarefas e conclusão da tarefa

**Decisão.** Concluir todas as subtarefas não conclui a tarefa sozinho: o app pergunta "Concluir a tarefa também?". Concluir a tarefa não marca as subtarefas. Numa tarefa que se repete, as subtarefas voltam a ficar abertas quando o prazo avança.

**Motivo.** Evita surpresas: às vezes a lista acaba e ainda falta conferir algo.

## D34 "O que você pretende fazer hoje?" e Meu dia

**Pedido do proprietário.** Uma pergunta diária, na primeira abertura do dia, com o que já está marcado, um jeito rápido de acrescentar o que a pessoa vai fazer e sugestões do que ela costuma fazer.

**Decisão.**

- A pergunta abre sozinha uma vez por dia (pode ser desligada em Perfil > Preferências). "Agora não" fecha até o dia seguinte; "Começar o dia" registra a resposta em `daily_checkins`.
- O plano do dia é **pessoal** (`task_plans`): planejar uma tarefa compartilhada para hoje não muda nada para os outros membros.
- As sugestões seguem regras fixas e explicáveis, sem IA: hábitos previstos para hoje e ainda não feitos, tarefas que se repetem e vencem nos próximos 3 dias e o que a pessoa concluiu com frequência nos últimos 30 dias, principalmente no mesmo dia da semana. Cada sugestão mostra o motivo.
- Na adição rápida, "Meu dia" só recebe o que é para hoje: "pão amanhã" digitado na visão Hoje fica para amanhã.

## D35 Blocos de tempo e planejador

**Decisão.** Reservar tempo para uma tarefa cria um **evento ligado à tarefa** (`events.task_id`). O bloco aparece no calendário, entra nos horários ocupados e pode ser movido ou apagado como qualquer evento, sem mexer na tarefa.

**Planejar minha semana.** Regras fixas (`utils/planner.ts`): só horários livres dentro da janela do dia da pessoa; nunca mexe em compromissos existentes; prazo mais próximo primeiro, depois prioridade, depois duração; tarefas longas viram blocos de até 60 minutos; sem estimativa, 30 minutos. Nada é gravado até a pessoa revisar e confirmar.

## D36 Disponibilidade e enquetes de horário

**Decisão.**

- "Encontrar horário" usa só **horários ocupados**, sem título, local nem participantes (`list_busy_times`).
- Compromissos da agenda em questão entram para todos os membros. Compromissos de **outras** agendas de alguém só entram se essa pessoa ligou "Compartilhar minha disponibilidade" (desligado por padrão).
- A consulta vale para no máximo 62 dias.
- Enquete: cada participante vota em cada horário (posso, talvez, não posso). O evento só é criado quando quem abriu a enquete encerra e escolhe o horário.

**Motivo.** Achar um horário em comum não pode virar um jeito de espiar a agenda dos outros.

## D37 Adição rápida sem inteligência artificial

**Decisão.** A frase digitada ("Reunião com Paulo terça das 14h às 15h", "Pagar luz todo dia 10 #casa !!") é interpretada por regras fixas em português (`utils/quickAdd.ts`), no próprio aparelho e sem internet. Etiquetas usam `#` e a prioridade, `!`, `!!`, `!!!` ou a palavra "urgente". Quando há dúvida ("às 3" pode ser 03:00 ou 15:00, "de manhã", um dia que o mês não tem, "semana que vem"), o app mostra uma prévia editável em vez de salvar direto.

**Motivo.** Nenhum serviço pago nem envio do texto para terceiros; o resultado é previsível e testado.

## D38 Arquivos .ics

**Decisão.**

- **Exportar:** gera o arquivo da agenda (padrão RFC 5545) com repetições, exclusões e ocorrências alteradas. No navegador baixa o arquivo; no Android abre a folha de compartilhar com o conteúdo. Eventos marcados como "Ocupado" para você não saem no arquivo.
- **Importar:** colando o conteúdo do arquivo ou, no navegador, escolhendo o arquivo. Mostra a prévia antes de importar e guarda o identificador de origem (`events.external_uid`), então importar o mesmo arquivo de novo não duplica.
- Repetições que o SynCK não representa (como "segunda terça do mês") entram como evento único, e a prévia avisa quantos foram.

**Motivo.** Funciona sem pedir nenhuma permissão nova no Android e sem bibliotecas nativas novas.

## D39 Animações no navegador

**Contexto.** Na versão web, as animações de entrada e de layout da biblioteca Reanimated às vezes deixavam o elemento com posição absoluta depois de entrar (principalmente uma animação dentro de outra). O item saía do fluxo da página e o que vinha depois ficava por cima dele.

**Decisão.** Todo componente com entrada, saída ou mudança de layout usa `MotionView` (`components/motion.tsx`). No celular ele é o `Animated.View` de sempre. No navegador, a entrada vira um esmaecer feito só com opacidade e deslocamento visual, que não mexe no layout, e saída e reposicionamento são imediatos.

**Garantia.** Os testes de tela conferem, antes de cada captura, que não há animação de layout presa, e um teste mede na tela Hoje do computador que nenhum título de seção fica por cima de um item.

**Também na web.** Voltar sem tela anterior (página aberta pelo endereço) leva para a tela Hoje (`services/navigation.ts`), em vez de não fazer nada.


## D40 Widgets da tela inicial com react-native-android-widget

**Alternativas.** (a) Widgets nativos escritos em Kotlin, com um módulo próprio para receber os dados; (b) `react-native-android-widget`, que desenha o widget a partir de componentes em JavaScript e tem plugin para o Expo.

**Decisão.** (b). O app grava um retrato compacto da agenda (`src/widgets/snapshot.ts`: título, horário e cor dos itens de ontem até daqui a 14 dias, dias com algo marcado e o evento da contagem) e os widgets leem esse retrato, inclusive com o app fechado, quando o Android pede (ao adicionar, redimensionar e a cada 30 minutos).

**Motivo.** Mantém tudo em TypeScript, com as mesmas cores, fonte e datas do app, sem código nativo próprio para manter. O retrato não leva descrição, local nem pessoas, porque a tela inicial fica à vista de quem pega o celular, e é apagado ao sair da conta.

**Consequência.** A biblioteca usa o WorkManager, que traz a permissão FOREGROUND_SERVICE (ver D22). Ela não aparece para a pessoa e não dá acesso a dados.
