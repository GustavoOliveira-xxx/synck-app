# Guia de desenvolvimento

Passo a passo para preparar um computador, rodar o app e o banco localmente, e fazer mudanças com segurança. Cada comando informa **pasta**, **finalidade**, **resultado esperado** e **o que fazer se falhar**.

> Só quer gerar o APK? Não precisa de nada disto: o GitHub gera para você ([GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md)).

## Visão geral

| Peça | Ferramenta | Obrigatória? |
|---|---|---|
| Node.js 22 (inclui o npm) | Rodar o app, os testes e as ferramentas | Sim |
| Git | Baixar e enviar o código | Sim |
| Celular Android com o app **Expo Go**, ou Android Studio com emulador | Ver o app rodando | Um dos dois |
| Android Studio | Emulador, builds nativos locais | Opcional |
| Docker Desktop | Supabase local completo | Opcional (dá para usar um projeto Supabase de desenvolvimento na nuvem) |

Não é preciso instalar o "Expo CLI" globalmente: o projeto usa `npx expo`, que vem nas dependências.

## 1. Instalar o Node.js e o npm

1. Baixe a versão **LTS 22 ou mais nova** em <https://nodejs.org> e instale com as opções padrão. O **npm** vem junto. (Este projeto usa npm; pnpm não é necessário.)
2. Confira:

```bash
# Pasta: qualquer uma
# Finalidade: confirmar a instalação
node -v
npm -v
```

- **Esperado:** `v22.x.x` (ou maior) e `10.x.x` (ou maior).
- **Se falhar** ("comando não encontrado"): feche e abra o terminal de novo. No Windows, reinicie o computador. Se a versão for menor que 22, instale a LTS atual.

## 2. Instalar o Git e baixar o projeto

1. Baixe em <https://git-scm.com> e instale com as opções padrão.
2. Configure seu nome e e-mail (aparecem como autor dos commits):

```bash
# Pasta: qualquer uma
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"
```

3. Baixe o projeto:

```bash
# Pasta: onde você guarda seus projetos (ex.: Documentos)
# Finalidade: copiar o repositório para o computador
git clone https://github.com/GustavoOliveira-xxx/synck-app.git
cd synck-app
```

- **Esperado:** a pasta `synck-app` com `app-mobile/`, `supabase/` e os arquivos `.md`.
- **Se falhar** com erro de autenticação: o repositório é público, então confira o endereço. Para enviar mudanças, entre na conta do GitHub quando o Git pedir (pelo navegador).

## 3. Instalar as dependências

```bash
# Pasta: app-mobile
# Finalidade: baixar as bibliotecas do app (versões exatas do package-lock.json)
npm ci
```

```bash
# Pasta: supabase
# Finalidade: baixar o PGlite, usado nos testes do banco
npm ci
```

- **Esperado:** termina com "added N packages" e cria a pasta `node_modules` (não vai para o GitHub).
- **Se falhar:** apague a pasta `node_modules` e rode de novo. Erro de versão do Node: veja o passo 1. Erro de rede: tente outra conexão.

**Para adicionar uma biblioteca ao app,** use `npx expo install nome-da-biblioteca` (escolhe a versão compatível com o SDK). Se a rede bloquear `api.expo.dev`, use `EXPO_OFFLINE=1 npx expo install nome-da-biblioteca`. Antes de adicionar, verifique se ela pede permissões no Android (o build falha se surgir permissão fora da lista aprovada, veja [DECISOES.md, D22](DECISOES.md#d22-lista-fechada-de-permissões-do-android)).

## 4. Configurar o banco

Escolha **uma** opção.

### Opção A (mais simples): projeto Supabase de desenvolvimento na nuvem

Crie um projeto **separado** do de produção (ou use o de produção só se for um teste pessoal) e aplique as migrations como no [GUIA_DE_DEPLOY.md, parte 1](GUIA_DE_DEPLOY.md#parte-1-servidor-supabase). Em projeto de desenvolvimento, você pode também rodar o `supabase/seed.sql` para ter dados de demonstração.

### Opção B: Supabase local (precisa do Docker)

1. Instale e abra o **Docker Desktop** (<https://www.docker.com>).
2. Suba o banco local:

```bash
# Pasta: raiz do projeto (synck-app)
# Finalidade: subir Postgres, Auth e Realtime locais, aplicar as migrations e o seed
npx supabase start
```

- **Esperado:** depois de alguns minutos (na primeira vez baixa as imagens), mostra `API URL: http://127.0.0.1:54321` e uma chave **publishable/anon**. As migrations de `supabase/migrations` e o `supabase/seed.sql` são aplicados sozinhos.
- **Se falhar:** "Cannot connect to the Docker daemon": abra o Docker Desktop. Porta ocupada: `npx supabase stop` e tente de novo.

Outros comandos úteis:

```bash
# Pasta: raiz do projeto
npx supabase status      # mostra URLs e chaves locais de novo
npx supabase db reset    # apaga o banco local e reaplica migrations + seed
npx supabase stop        # desliga
```

Painel local (Supabase Studio): <http://127.0.0.1:54323>. E-mails enviados localmente (códigos de confirmação) aparecem em <http://127.0.0.1:54324>.

**Contas de demonstração** (só no banco local ou de desenvolvimento): `ana.demo@exemplo.test`, `bruno.demo@exemplo.test`, `carla.demo@exemplo.test` e `davi.demo@exemplo.test`, todas com a senha `Demo@2026!`. São fictícias.

## 5. Configurar as variáveis de ambiente do app

```bash
# Pasta: app-mobile
# Finalidade: criar o arquivo com o endereço do servidor
cp .env.example .env          # no Windows (PowerShell): Copy-Item .env.example .env
```

Abra o `app-mobile/.env` e preencha:

| Variável | Opção A (nuvem) | Opção B (local) |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL do painel | No emulador Android: `http://10.0.2.2:54321`. No celular físico: `http://IP-DO-COMPUTADOR:54321` (mesma rede Wi-Fi) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Publishable key do painel | A chave mostrada por `npx supabase status` |

- O `.env` **nunca** vai para o GitHub (está no `.gitignore`).
- **Nunca** coloque a chave `secret`/`service_role` aqui.
- Endereços `http://` (Supabase local) só funcionam no modo de desenvolvimento (`npx expo start` ou `npx expo run:android`). O APK de produção exige `https://`.
- Depois de mudar o `.env`, reinicie o Metro com `npx expo start -c`.

## 6. Preparar onde o app vai rodar

### 6.1 Celular físico com Expo Go (mais rápido)

1. No celular, instale o **Expo Go** pela Play Store.
2. Computador e celular na **mesma rede Wi-Fi**.
3. Siga o passo 7 e leia o QR code com o Expo Go.

Limitações do Expo Go: ele só roda projetos na versão de SDK mais recente; se avisar de incompatibilidade, use a opção 6.3.

### 6.2 Android Studio, SDK e emulador

1. Instale o **Android Studio** (<https://developer.android.com/studio>) com as opções padrão (inclui Android SDK, Platform Tools e emulador).
2. Configure as variáveis de ambiente para o SDK:
   - **Windows:** Painel de Controle > Sistema > Configurações avançadas > Variáveis de ambiente > nova variável de usuário `ANDROID_HOME` = `C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk`; edite `Path` e adicione `%ANDROID_HOME%\platform-tools`.
   - **macOS/Linux:** no `~/.zshrc` ou `~/.bashrc`: `export ANDROID_HOME=$HOME/Library/Android/sdk` (macOS) ou `$HOME/Android/Sdk` (Linux) e `export PATH=$PATH:$ANDROID_HOME/platform-tools`.
3. Confira:

```bash
# Pasta: qualquer uma (abra um terminal novo)
adb version
```

   - **Esperado:** "Android Debug Bridge version ...".
   - **Se falhar:** confira o caminho do SDK em Android Studio > Settings > Android SDK ("Android SDK Location").

4. Crie um emulador: Android Studio > **Device Manager** > **Create Virtual Device** > um Pixel > imagem de sistema recente (API 35 ou mais) > Finish > botão ▶ para ligar.

### 6.3 Celular físico por cabo (depuração USB)

1. No celular: **Configurações > Sobre o telefone** > toque 7 vezes em **Número da versão** (ativa as "Opções do desenvolvedor").
2. **Configurações > Sistema > Opções do desenvolvedor** > ative **Depuração USB**.
3. Ligue o cabo e aceite "Permitir depuração USB" no celular.
4. Confira com `adb devices` (deve listar o aparelho como `device`).

## 7. Executar o app

```bash
# Pasta: app-mobile
# Finalidade: iniciar o servidor de desenvolvimento (Metro)
npx expo start
```

- **Esperado:** um QR code e um menu. Tecle **a** para abrir no emulador/celular via cabo, ou leia o QR code com o Expo Go. Ao salvar um arquivo, o app atualiza sozinho.
- **Se falhar:** veja [TROUBLESHOOTING.md, desenvolvimento](TROUBLESHOOTING.md#desenvolvimento-computador).

Build de desenvolvimento nativo (quando o Expo Go não serve, ou para testar lembretes como no APK):

```bash
# Pasta: app-mobile
# Finalidade: gerar o projeto Android nativo e instalar no emulador/celular conectado
npx expo run:android
```

- **Esperado:** compila (a primeira vez demora de 10 a 20 minutos) e abre o app.
- **Se falhar:** "SDK location not found": passo 6.2. Depois de usar, desfaça a alteração que o comando faz no `package.json` (`git checkout package.json`); a pasta `android/` gerada é ignorada pelo Git.

Versão web (a mesma usada no iPhone e no computador; lembretes não tocam na web):

```bash
# Pasta: app-mobile
npx expo start --web
```

- **Esperado:** abre o app no navegador. Para ver como fica em cada aparelho, use as ferramentas do navegador (F12 > ícone de celular) e troque a largura: menos de 600 é celular, a partir de 768 aparece o menu lateral e a partir de 1024 o calendário fica em duas colunas (`src/utils/layout.ts`).
- O modo offline (service worker) só funciona no site gerado (`npx expo export --platform web`), não no `expo start`.

Gerar o site como ele é publicado no GitHub Pages (numa subpasta):

```bash
# Pasta: app-mobile (com o .env preenchido)
SITE_BASE_PATH=/synck-app npx expo export --platform web --output-dir dist-site
cp dist-site/index.html dist-site/404.html
```

## 8. Ver os registros (logs)

| Onde | Como |
|---|---|
| App em desenvolvimento | O terminal do `npx expo start` mostra `console.warn`/`console.error`. Tecle **j** para abrir o depurador |
| Celular via cabo | `adb logcat *:E ReactNativeJS:V` mostra erros nativos e do JavaScript |
| No próprio app | **Perfil > Diagnóstico (desenvolvimento)**: últimos erros, estado da sincronização (sem dados pessoais) |
| Servidor | Painel do Supabase > **Logs** (API, Auth, Postgres) |

## 9. Qualidade: lint, formatação, tipos e testes

```bash
# Pasta: app-mobile
npm run typecheck      # confere os tipos do TypeScript. Esperado: nenhuma saída de erro
npm run lint           # procura problemas comuns de código. Esperado: nenhuma linha de erro
npm run format:check   # confere a formatação. Se falhar, rode: npm run format
npm test               # testes do app (Jest). Esperado: "Tests: N passed"
npm run check          # os quatro acima, em sequência
```

```bash
# Pasta: supabase
npm test               # testes do banco com PGlite (permissões, convites, eventos, LGPD)
                       # Esperado: "# fail 0"
```

```bash
# Pasta: e2e (precisa de npm ci em supabase, app-mobile e e2e)
npm run preparar       # gera a versão web do app (1 a 2 minutos)
CHROMIUM_PATH=/usr/bin/google-chrome npm test
                       # testes de tela: login, calendário, evento, membros, convite e privacidade
                       # Esperado: "# pass 7". Capturas de cada tela em e2e/saida/
npm run preparar:site  # gera o site numa subpasta, como no GitHub Pages
CHROMIUM_PATH=/usr/bin/google-chrome npm run test:site
                       # versão instalável: manifesto, ícones, link direto, sem internet. Esperado: "# pass 6"
```

- O teste de tela precisa do Chrome ou Chromium instalado. Informe o caminho em `CHROMIUM_PATH` (Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`, macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`). O comando `npm run preparar` usa a sintaxe de variáveis do Linux/macOS; no Windows, rode-o pelo Git Bash.

```bash
# Pasta: raiz do projeto
bash scripts/verificar-segredos.sh   # procura senhas e chaves no código
                                     # Esperado: "OK: nenhum segredo encontrado"
```

- **Se um teste falhar:** a mensagem mostra o arquivo e o valor esperado versus o recebido. Corrija o código (não o teste), a menos que a regra tenha mudado de propósito.
- Os mesmos comandos rodam no GitHub (workflow **Qualidade**) a cada envio. Detalhes em [docs/TESTES.md](docs/TESTES.md).

## 10. Gerar APK no computador (opcional)

O caminho normal é o GitHub Actions. Localmente (precisa do Android Studio e do Java 17):

```bash
# Pasta: app-mobile
npx expo prebuild --platform android
cd android
./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a   # Windows: gradlew.bat
```

- **Esperado:** `android/app/build/outputs/apk/release/app-release.apk` (assinado com a chave de testes).
- Depois, desfaça a mudança no `package.json` (`git checkout package.json`).

## 11. Como o código está organizado

Resumo (detalhes em [ARQUITETURA.md](ARQUITETURA.md)):

| Pasta | O que tem | Regra |
|---|---|---|
| `app-mobile/src/app` | Rotas (cada arquivo é uma tela navegável) | Só monta a tela; o conteúdo fica em `src/screens` |
| `app-mobile/src/screens` | Conteúdo das telas | Usa componentes, hooks e serviços; não chama o Supabase direto |
| `app-mobile/src/services` | Única camada que fala com o Supabase | Trocar de backend no futuro = reescrever esta pasta |
| `app-mobile/src/offline` | Cache, fila e motor de sincronização | Toda alteração de evento passa pela fila |
| `app-mobile/src/utils`, `src/validation` | Lógica pura (datas, recorrência, permissões, validações) | Sem React, sempre com testes |
| `app-mobile/src/i18n/pt-BR.ts` | Todos os textos | Nenhum texto fixo dentro das telas |
| `supabase/migrations` | SQL do banco | Nunca edite uma migration já aplicada em produção: crie uma nova |
| `supabase/tests` | Testes do banco | Toda regra de permissão nova ganha um teste |

## 12. Fluxo de trabalho

1. Crie uma branch: `git checkout -b minha-mudanca`.
2. Faça a mudança, com testes quando for lógica.
3. Rode `npm run check` (app) e `npm test` (supabase).
4. Commit em português, no formato `tipo(área): descrição` (ex.: `fix(app): lembrete duplicado após editar evento`). Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `style`.
5. `git push -u origin minha-mudanca` e abra um pull request no GitHub. O workflow **Qualidade** roda sozinho; o **Gerar APK Android** também, quando a mudança mexe no app.
6. Registre decisões importantes em [DECISOES.md](DECISOES.md) e mudanças visíveis no [CHANGELOG.md](CHANGELOG.md).

### Mudando o banco

1. Crie um arquivo novo em `supabase/migrations` com data e hora no nome (ex.: `20261105120000_lembretes_por_email.sql`).
2. Escreva testes em `supabase/tests` e rode `npm test` na pasta `supabase`.
3. Se mudou permissões, confira também `supabase/migrations/20261020000600_security.sql` (concessões por coluna e por função).
4. Depois do merge, aplique a migration no projeto de produção ([GUIA_DE_DEPLOY.md, parte 4](GUIA_DE_DEPLOY.md#parte-4-lançar-novas-versões)).

## 13. Erros comuns

Veja [TROUBLESHOOTING.md](TROUBLESHOOTING.md#desenvolvimento-computador).

## 10. Logo, ícones e widgets

- **Logo em SVG:** `app-mobile/assets/brand/svg` tem o personagem, os logos vertical e horizontal (vetorizados da arte original) e `synck-simbolo.svg`, o símbolo de uma cor (notificações, ícone temático do Android e widgets).
- **Ícones do app** (Android, notificação, splash, favicon e PWA) saem desses SVGs. Depois de mudar um SVG:

```bash
# Pasta: raiz do projeto (precisa de npm ci em e2e, que traz o navegador usado para desenhar)
node scripts/gerar-icones-do-app.mjs
node scripts/gerar-previas-widgets.mjs
```

- **Widgets da tela inicial (Android):** ficam em `app-mobile/src/widgets` e são configurados em `app.json` (plugin `react-native-android-widget`). Só funcionam no APK (não no Expo Go nem na web). O app grava um retrato dos próximos dias (`useWidgetSync`) e os widgets leem esse retrato, mesmo com o app fechado.
