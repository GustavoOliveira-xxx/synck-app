# SynCK

> Sua rotina, sincronizada com quem importa. Um produto CK Group.

Aplicativo de **agenda, tarefas e planejamento compartilhados** para **Android, iPhone, iPad e computador**: você cria agendas, convida pessoas e todo mundo vê os mesmos compromissos, tarefas e lembretes, sincronizados pela internet, cada pessoa com o nível de acesso que você escolher. Funciona para casal, família, amigos, república, equipe pequena, grupo de estudo, cuidadores e viagens.

**Versão atual: 3.0.0.** O que mudou está no [CHANGELOG.md](CHANGELOG.md); o que já foi validado e o que ainda depende de teste no aparelho, em [docs/VALIDACAO_3.0.md](docs/VALIDACAO_3.0.md).

> **Comece aqui (para quem não programa)**
>
> 1. **Quero instalar:** siga o [COMO_INSTALAR.md](COMO_INSTALAR.md) (Android, iPhone, iPad ou computador).
> 2. **Quero colocar o app no ar pela primeira vez** (servidor, APK, site, chave de assinatura): siga o [GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md). São cliques no painel do Supabase e do GitHub, sem programar.
> 3. **Algo deu errado:** veja o [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
> 4. **O que fica para as próximas versões:** veja o [ROADMAP.md](ROADMAP.md).

## Onde funciona

| Aparelho | Como usar | Lembretes que tocam |
|---|---|---|
| Android (celular e tablet) | App instalado pelo **APK** ([COMO_INSTALAR.md, opção A](COMO_INSTALAR.md#opção-a-instalação-do-apk)) | Sim, com o ícone do SynCK e os botões Abrir e Adiar 10 min |
| iPhone e iPad | **Versão web instalável**: Safari > Compartilhar > Adicionar à Tela de Início ([opção C](COMO_INSTALAR.md#opção-c-iphone-ipad-computador-ou-qualquer-celular-versão-web)) | Sim, depois de ativar em Perfil > Notificações (iPhone com iOS 16.4 ou mais novo) |
| Computador (Windows, Mac, Linux) | No navegador ou instalado como aplicativo pelo Chrome, Edge ou Safari ([opção C](COMO_INSTALAR.md#opção-c-iphone-ipad-computador-ou-qualquer-celular-versão-web)) | Sim, depois de ativar em Perfil > Notificações |

A tela se adapta ao tamanho: no celular, abas embaixo; no tablet, menu lateral; no computador, menu lateral com o mês e os eventos do dia lado a lado. Um app nativo de iPhone na App Store também é possível, mas exige conta paga da Apple ([GUIA_DE_DEPLOY.md, parte 7](GUIA_DE_DEPLOY.md#parte-7-app-nativo-para-iphone-app-store)).

## Que problema resolve

Quem divide a vida com outras pessoas costuma combinar compromissos por mensagem e perde informação: "era terça ou quarta?", "quem leva a vó no médico?", "você sabia da reunião da escola?". O app junta tudo em um calendário único, com:

- cada pessoa vendo só o que deve ver (eventos e tarefas podem ser privados ou só para participantes);
- tarefas com responsável, prazo e subtarefas, sem precisar virar compromisso na agenda;
- um momento de planejar o dia ("O que você pretende fazer hoje?") e a semana;
- lembretes no celular de cada um;
- funcionamento sem internet (as mudanças são enviadas quando a conexão volta);
- histórico de quem mudou o quê.

## Funcionalidades

| Área | O que já funciona nesta versão |
|---|---|
| Conta | Cadastro, login, confirmação de e-mail por código (opcional), recuperação de senha por código, troca de senha, perfil com avatar de iniciais, lista de aparelhos conectados, sair, exportar dados, excluir conta |
| Agendas | Várias agendas por pessoa, cor, tipo (pessoal, compartilhada, família, profissional, projeto, viagem, personalizada), fuso horário, arquivar, duplicar, lixeira por 30 dias |
| Compartilhamento | Convite por **código** (enviado por WhatsApp ou qualquer app) ou para um **e-mail** cadastrado; prévia da agenda e do papel antes de aceitar; validade; cancelamento; limite de tentativas |
| Papéis | Proprietário, administrador, editor, colaborador e visualizador; transferência de propriedade; remoção com perda de acesso imediata |
| Eventos | Criar, editar, duplicar, cancelar, concluir, excluir e restaurar; dia inteiro; local; link; observações; participantes; 4 níveis de privacidade; comentários |
| Recorrência | Diária, semanal (dias da semana), quinzenal, mensal, anual, com fim por data ou quantidade; editar ou excluir "só este", "este e os próximos" ou "todos" |
| Calendário | Mês com marcadores de tarefas; semana e dia em grade de horários, com eventos simultâneos lado a lado, linha do horário atual e arrastar para mudar o horário; lista; filtros por agenda, tipo, status, participante, cor, privacidade, recorrência e período; busca em eventos, tarefas, lembretes, anotações e agendas |
| Tarefas | Aba própria com prazo (com ou sem horário), prioridade, estado, subtarefas, listas, etiquetas, estimativa, repetição pelo calendário ou depois da conclusão, responsável, participantes, comentários e histórico; visões Hoje, Próximos 7 dias, Atrasadas, Importantes, Atribuídas a mim e outras |
| Lembretes avulsos | Um aviso numa data, sem ocupar horário na agenda |
| Criar | Botão "O que você deseja adicionar?" (evento, tarefa, lembrete, anotação, hábito) e adição rápida em português: "Reunião com Paulo terça das 14h às 15h", "Pagar luz todo dia 10 #casa" |
| Planejar | "O que você pretende fazer hoje?" na primeira abertura do dia, com sugestões do que você costuma fazer; reservar tempo para uma tarefa; planejar a semana nos horários livres; resumo "Minha semana em sintonia" |
| Juntos | Encontrar horário em comum (só horários ocupados, sem detalhes) e enquetes de horário |
| Anotações e hábitos | Anotações pessoais ou da agenda; hábitos e rotinas com marcação diária |
| Arquivos .ics | Exportar uma agenda para Google Agenda, Outlook ou Apple e importar eventos sem duplicar |
| Lembretes | Notificações locais no celular (no horário, 5 min, 15 min, 30 min, 1 h, 1 dia antes ou personalizado); horário de silêncio; tela bloqueada sem detalhes por padrão |
| Offline | Cache local, fila de alterações (eventos, tarefas, lembretes, listas, anotações, hábitos e plano do dia) com novas tentativas automáticas, tela de sincronização, resolução de conflitos quando duas pessoas mudam o mesmo item |
| Tempo real | Alterações de outras pessoas aparecem sozinhas (Supabase Realtime) |
| Avisos | Central de avisos no app (convites, alterações em eventos, remoções, tarefas atribuídas, concluídas ou comentadas, enquetes) |
| Privacidade | LGPD: exportação de dados, exclusão de conta com explicação do impacto, política de privacidade no app |

O mapa completo de telas está em [docs/TELAS.md](docs/TELAS.md).

## Capturas de tela

| | | |
|---|---|---|
| ![Tela Hoje](docs/capturas/00-hoje.png) | ![Calendário do mês](docs/capturas/03-agenda-mes.png) | ![Lista de próximos eventos](docs/capturas/04-agenda-lista.png) |
| Hoje | Calendário do mês | Próximos eventos |
| ![Detalhes do evento](docs/capturas/05-evento-detalhe.png) | ![Membros e papéis](docs/capturas/08-membros.png) | ![Código de convite](docs/capturas/09-convite.png) |
| Detalhes do evento e lembretes | Membros e papéis | Código de convite |
| ![Avisos](docs/capturas/10-avisos.png) | ![Entrar](docs/capturas/02-login.png) | ![Tema escuro](docs/capturas/00-hoje-escuro.png) |
| Avisos | Entrar (com Google) | Tema escuro |
| ![O que você pretende fazer hoje?](docs/capturas/18-o-que-vai-fazer-hoje.png) | ![Tarefas](docs/capturas/19-tarefas.png) | ![O que você deseja adicionar?](docs/capturas/20-criar.png) |
| O que você pretende fazer hoje? | Tarefas | Criar qualquer coisa |
| ![Minha semana em sintonia](docs/capturas/21-semana-em-sintonia.png) | ![Encontrar horário](docs/capturas/22-encontrar-horario.png) | ![Busca](docs/capturas/23-busca.png) |
| Minha semana em sintonia | Encontrar horário em comum | Busca em tudo |

**No computador** (menu lateral com o logo; no Calendário, mês e eventos do dia lado a lado):

![Tela Hoje no computador](docs/capturas/14-computador-hoje.png)

Mais capturas em [`docs/capturas/`](docs/capturas/). **Como foram feitas:** a versão web do app (o mesmo código do APK) rodou num navegador com tamanho de celular, conectada a uma cópia local do banco com as migrations reais e os dados fictícios de demonstração (`supabase/seed.sql`), entrando como "Ana Demo". No celular o visual é o mesmo, com pequenas diferenças (por exemplo, os seletores de data e hora são os do Android).

## Tecnologias

| Parte | Tecnologia | Por quê (resumo) |
|---|---|---|
| App | React Native + **Expo SDK 58**, **TypeScript**, Expo Router | Um código só para Android e iOS; APK gerado de graça no GitHub |
| Estado e dados no celular | Zustand, AsyncStorage, `expo-secure-store` | Simples; sessão guardada no cofre do Android |
| Datas | Luxon | Fusos horários e horário de verão corretos |
| Servidor | **Supabase** (PostgreSQL 17, Auth, Realtime) | Login pronto, banco SQL, regras de acesso no próprio banco, plano gratuito |
| Testes | Jest (app), PGlite + `node:test` (banco) | Rodam no computador e no GitHub, sem Docker |
| CI/CD | GitHub Actions | Testa tudo a cada envio e gera APK/AAB |

Comparações e justificativas completas em [DECISOES.md](DECISOES.md).

## Arquitetura resumida

```mermaid
flowchart LR
  U[Pessoa] --> A[App Android<br/>Expo + TypeScript]
  A -- HTTPS + token --> S[(Supabase<br/>Auth + Postgres + Realtime)]
  A --> L[(Celular<br/>cache + fila offline<br/>sessão no cofre)]
  A --> N[Lembretes locais]
  G[GitHub Actions] -- gera --> K[APK / AAB]
```

Toda permissão é conferida **no banco** (Row Level Security e funções no servidor). Mesmo um app modificado não consegue ver ou mudar o que não pode. Detalhes em [ARQUITETURA.md](ARQUITETURA.md), [MODELO_DE_DADOS.md](MODELO_DE_DADOS.md), [REGRAS_DE_NEGOCIO.md](REGRAS_DE_NEGOCIO.md) e [SEGURANCA.md](SEGURANCA.md).

## Estrutura do repositório

```
app-mobile/          App (Expo). Código em app-mobile/src
supabase/            Banco: migrations (SQL), dados de demonstração e testes
e2e/                 Testes de tela (versão web do app contra o banco real)
docs/                Telas, design, acessibilidade, testes
scripts/             Verificação de segredos
.github/workflows/   Qualidade (testes) e Gerar APK Android
*.md                 Documentação
```

## Requisitos

**Para usar o app:** celular Android 7.0 ou mais novo (APK, cerca de 150 MB livres), ou qualquer aparelho com navegador atualizado (versão web: Safari no iPhone e iPad, Chrome, Edge ou Firefox no computador). Internet no primeiro acesso.

**Para colocar no ar (sem programar):** conta gratuita no [Supabase](https://supabase.com) e a conta do GitHub onde está este repositório. Passo a passo no [GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md).

**Para desenvolver:** Node.js 22 ou mais novo, Git e, opcionalmente, Android Studio. Passo a passo no [GUIA_DE_DESENVOLVIMENTO.md](GUIA_DE_DESENVOLVIMENTO.md).

## Instalação, configuração e execução (resumo)

| Quero... | Onde está explicado |
|---|---|
| Instalar o APK no celular | [COMO_INSTALAR.md](COMO_INSTALAR.md) |
| Criar o banco no Supabase e aplicar as migrations | [GUIA_DE_DEPLOY.md, parte 1](GUIA_DE_DEPLOY.md#parte-1-servidor-supabase) |
| Configurar o endereço do servidor no GitHub | [GUIA_DE_DEPLOY.md, parte 2](GUIA_DE_DEPLOY.md#parte-2-ligar-o-github-ao-servidor) |
| Rodar o app no computador ou no celular durante o desenvolvimento | [GUIA_DE_DESENVOLVIMENTO.md](GUIA_DE_DESENVOLVIMENTO.md) |

Execução rápida para quem já tem o ambiente pronto:

```bash
# Pasta: app-mobile
cp .env.example .env      # depois edite o .env com a URL e a chave pública do Supabase
npm ci                    # instala as dependências
npx expo start            # abre o servidor de desenvolvimento (leia o QR code com o app Expo Go ou use "a" para Android)
```

## Testes

```bash
# Pasta: supabase   (testa tabelas, permissões, convites, eventos, exclusão de conta)
npm ci && npm test

# Pasta: app-mobile (testa datas, recorrência, permissões, filtros, validações, fila offline, lembretes)
npm ci && npm run check   # tipos + lint + formatação + testes

# Pasta: e2e (abre a versão web do app em tamanho de celular, tablet e computador)
npm ci && npm run preparar && CHROMIUM_PATH=/caminho/do/chrome npm test
# Pasta: e2e (versão instalável: manifesto, ícones, link direto e abertura sem internet)
npm run preparar:site && CHROMIUM_PATH=/caminho/do/chrome npm run test:site
```

São 298 testes automáticos (92 do banco, 190 do app, 9 de tela e 7 da versão instalável). Os mesmos rodam sozinhos no GitHub a cada envio (workflow **Qualidade**). Estratégia, números e roteiro de teste manual em [docs/TESTES.md](docs/TESTES.md).

## Build, APK e AAB

- O **APK** (arquivo que se instala direto no celular) e o **AAB** (formato que a Google Play Store pede) são gerados pelo GitHub Actions, no workflow **Gerar APK Android**.
- Para gerar e publicar um APK com link de download: GitHub > **Actions** > **Gerar APK Android** > **Run workflow**. Em cerca de 20 minutos o arquivo aparece em **Releases**.
- Sem uma chave de assinatura própria, o APK sai assinado com uma **chave de testes** (marcado como "pré-lançamento"). Serve para testar entre pessoas conhecidas. Para distribuir de verdade, configure sua chave: [GUIA_DE_DEPLOY.md, parte 3](GUIA_DE_DEPLOY.md#parte-3-chave-de-assinatura-própria).

Tamanho (build 4): APK de 48 MB e AAB de 37 MB. Android mínimo: 7.0. Permissões pedidas (e o porquê de cada uma): [DECISOES.md, D22](DECISOES.md#d22-lista-fechada-de-permissões-do-android).

## Publicação

- **Distribuição direta (APK):** página [Releases](https://github.com/GustavoOliveira-xxx/synck-app/releases) do repositório.
- **Google Play Store (AAB):** requer conta de desenvolvedor e uma série de cadastros; o caminho está no [GUIA_DE_DEPLOY.md, parte 5](GUIA_DE_DEPLOY.md#parte-5-google-play-store).
- **Versão web (iPhone, iPad, computador):** publicada no GitHub Pages pelo workflow **Publicar versão web**, em <https://gustavooliveira-xxx.github.io/synck-app/> depois de ligar o Pages ([GUIA_DE_DEPLOY.md, parte 6](GUIA_DE_DEPLOY.md#parte-6-versão-web-iphone-ipad-computador-e-qualquer-sistema)).
- **App nativo de iPhone (App Store):** o código é compatível, mas a publicação exige conta Apple Developer paga; explicado no [GUIA_DE_DEPLOY.md, parte 7](GUIA_DE_DEPLOY.md#parte-7-app-nativo-para-iphone-app-store).

## Problemas comuns

Veja [TROUBLESHOOTING.md](TROUBLESHOOTING.md) (app, instalação, servidor, GitHub Actions e desenvolvimento) e a seção de problemas do [COMO_INSTALAR.md](COMO_INSTALAR.md#problemas-comuns).

## Roadmap

Integrações futuras (Google Calendar, exportação ICS, push remoto, anexos, login com Google, 2FA e outras), com dependências, riscos, permissões, impacto em privacidade, banco e custos: [ROADMAP.md](ROADMAP.md). Histórico de versões: [CHANGELOG.md](CHANGELOG.md).

## Limitações conhecidas

- **Servidor pausado:** o projeto Supabase da conta está pausado e não pôde ser reativado automaticamente porque a conta já tem 2 projetos gratuitos ativos (limite do plano). Enquanto isso, o app instalado abre na tela "Servidor não configurado" ou não conecta. Como resolver: [GUIA_DE_DEPLOY.md, parte 1](GUIA_DE_DEPLOY.md#parte-1-servidor-supabase).
- **Não testado em celular físico** nem com o Supabase real: a lógica foi testada automaticamente (banco e app), as telas principais foram testadas automaticamente na versão web contra uma cópia local do banco, e o APK compila no GitHub. O uso no celular ainda precisa do roteiro manual de [docs/TESTES.md](docs/TESTES.md) (login real, notificações, offline, tempo real).
- **E-mail:** sem um servidor de e-mail próprio (SMTP), o Supabase só envia e-mails para membros da equipe do projeto. Por isso o guia recomenda desligar a confirmação de e-mail no começo.
- **Convite por e-mail não envia e-mail:** o convite fica registrado e aparece para a pessoa quando ela entra com aquele e-mail. O jeito principal de convidar é o código.
- **Lembretes são locais:** cada celular Android agenda os próprios lembretes; não há push remoto do servidor nesta versão. **Na versão web (iPhone, iPad e computador) os lembretes não tocam.**
- **APK de testes:** sem configurar sua chave, o APK usa a chave pública de testes do Android.
- **Somente português do Brasil** nesta versão (a estrutura de tradução está pronta).
- **App nativo de iPhone** não foi compilado nem testado (exige conta paga da Apple). No iPhone, use a versão web instalável.
- **Versão web:** testada automaticamente no Chrome (tamanhos de celular, tablet e computador); ainda não conferida num iPhone de verdade.

## Licença

[MIT](LICENSE). Você pode usar, copiar e modificar, mantendo o aviso de copyright.

## Créditos

- Autor e proprietário: **Gustavo Oliveira dos Santos**.
- Bibliotecas de código aberto listadas em `app-mobile/package.json` e `supabase/package.json`, cada uma com sua licença.
