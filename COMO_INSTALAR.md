# Como instalar o SynCK

Este guia é para quem **não programa**. Escolha pelo aparelho:

| Seu aparelho | Caminho |
|---|---|
| Celular ou tablet **Android** | **Opção A: arquivo APK** (app completo, com lembretes que tocam) ou a opção C |
| **iPhone** ou **iPad** | **Opção C: versão web instalável** (ícone na tela de início, funciona sem internet) |
| **Computador** (Windows, Mac, Linux) | **Opção C**: no navegador ou instalado como aplicativo |
| Qualquer aparelho, pela loja | **Opção B: Google Play Store** (só depois que o app for publicado) |

> **Antes de tudo:** o app precisa de um servidor configurado para funcionar. Se você é a pessoa responsável pelo projeto e ainda não fez isso, siga primeiro o [GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md). Se você recebeu o link de alguém, pode seguir direto.

## O que você precisa (opção A, Android)

| Item | Requisito |
|---|---|
| Sistema | Android **7.0 ou mais novo** (Configurações > Sobre o telefone > Versão do Android) |
| Processador | ARM (praticamente todos os celulares; o APK não instala em emuladores de computador x86) |
| Download | Cerca de 50 MB (o APK) |
| Espaço | Cerca de 150 MB livres |
| Internet | Necessária para criar conta e entrar; depois o app também funciona offline |

## Opção A: instalação do APK

APK é o "instalador" de um aplicativo Android, como um arquivo `.exe` no Windows. Ele não vem da Play Store, por isso o Android pede uma autorização extra.

### Passo 1. Baixar o arquivo de uma fonte confiável

1. No celular, abra o navegador (Chrome, por exemplo).
2. Entre na página **Releases** do projeto: <https://github.com/GustavoOliveira-xxx/synck-app/releases>
   (ou use o link que a pessoa responsável enviou para você).
3. Na versão mais recente (a primeira da lista), toque em **Assets** para abrir a lista de arquivos.
4. Toque no arquivo que termina em **`.apk`**. **Não** baixe o `.aab`: ele serve só para a Play Store e não instala no celular.

**Resultado esperado:** o navegador mostra o download (pode avisar que "este tipo de arquivo pode ser perigoso"; isso aparece para qualquer APK fora da Play Store). Toque em **Baixar mesmo assim** se você confia na origem.

### Passo 2. Verificar nome e versão

O nome do arquivo segue o padrão:

```
synck-v1.0.0-build4.apk
                      │      └─ número da compilação (sempre cresce)
                      └─ versão do app
```

- Confira se o nome começa com **`synck`** e se a versão é a mais recente da página Releases.
- A partir da versão **3.5.0**, os APKs oficiais usam a chave própria de distribuição. Versões antigas de testes precisam da migração descrita em [Assinatura própria](docs/ASSINATURA_ANDROID.md).

### Passo 3. Abrir o arquivo

Quando o download terminar, toque em **Abrir** na notificação do download. Se perdeu a notificação, abra o app **Arquivos** (ou **Meus arquivos**) > **Downloads** e toque no arquivo.

### Passo 4. Permitir a instalação, se o Android pedir

Na primeira vez, o Android mostra algo como **"Por segurança, seu telefone não tem permissão para instalar apps desconhecidos desta fonte"**.

1. Toque em **Configurações**.
2. Ative **Permitir desta fonte** (para o navegador ou gerenciador de arquivos que você usou).
3. Volte (seta de voltar).

O caminho exato varia por marca. Em geral fica em: **Configurações > Apps > Acesso especial > Instalar apps desconhecidos**.

### Passo 5. Confirmar a instalação

Toque em **Instalar**. O Google Play Protect pode mostrar um aviso de "app não reconhecido", porque o app não veio da loja. Se você confia na origem, toque em **Mais detalhes > Instalar mesmo assim**.

**Resultado esperado:** "App instalado".

### Passo 6. Abrir o aplicativo

Toque em **Abrir** (ou procure o ícone **SynCK** na tela inicial). Na primeira abertura:

- Se aparecer **"Servidor não configurado"**, o APK foi gerado sem o endereço do servidor. Avise a pessoa responsável (ela precisa seguir a [parte 2 do GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md#parte-2-ligar-o-github-ao-servidor) e gerar um APK novo).
- Em Android 13 ou mais novo, o app vai pedir permissão para **enviar notificações**. Toque em **Permitir** se quiser receber lembretes. Dá para mudar depois.

### Passo 7. Criar uma conta ou entrar

Use e-mail e senha ou toque em **Entrar com Google** (se a pessoa responsável já ativou essa opção).

1. Na tela de boas-vindas, toque em **Criar conta**.
2. Informe nome, e-mail e uma senha de pelo menos 8 caracteres, com letras e números.
3. Se o projeto exigir confirmação de e-mail, digite o código de 6 dígitos que chegou no seu e-mail.
4. Pronto: você já tem a agenda "Minha agenda". Para entrar na agenda de alguém, toque em **Agendas > Entrar com código de convite** e digite o código que a pessoa enviou.

### Passo 8. Desativar de novo a permissão de fontes desconhecidas (recomendado)

Depois de instalar, volte em **Configurações > Apps > Acesso especial > Instalar apps desconhecidos**, escolha o navegador que você usou e **desative**. O app continua instalado; isso só evita que outros arquivos sejam instalados sem você perceber.

### Riscos de instalar APKs fora da Play Store

- Um APK pode ser alterado por terceiros para roubar dados. **Só baixe da página Releases oficial do projeto** ou de um link enviado por quem você conhece.
- Nunca instale um APK com nome parecido vindo de grupos, sites de download ou anexos de desconhecidos.
- O app **não pede** acesso a câmera, microfone, localização, contatos, fotos ou SMS. Se um APK com este nome pedir isso, **não instale**: não é o original.
- Quem distribui o app deve usar uma chave de assinatura própria ([GUIA_DE_DEPLOY.md, parte 3](GUIA_DE_DEPLOY.md#parte-3-chave-de-assinatura-própria)). Assim, o Android só aceita atualizações assinadas pela mesma chave.

### Permissões que o app usa

| Permissão | Para quê | O Android pergunta? |
|---|---|---|
| Notificações | Mostrar os lembretes | Sim (Android 13 ou mais novo) |
| Internet e estado da rede | Sincronizar e saber se está offline | Não |
| Iniciar com o aparelho | Reagendar lembretes depois de reiniciar o celular | Não |
| Vibração e manter ativo | Vibrar e entregar o lembrete com a tela apagada | Não |

### Como atualizar

O app do Android **não se atualiza sozinho** (ele não vem da Play Store). A partir da versão 1.2.0, quando sai uma versão nova, o app avisa ao abrir ("Há uma versão nova do app") e mostra **Baixar versão nova** no Perfil. Tocar ali baixa o APK novo.

1. Baixe o APK mais novo pelo aviso ou pela página Releases (passos 1 a 5). O Android vai perguntar **"Deseja instalar uma atualização?"**. Toque em **Instalar**.
2. Seus dados continuam: eles ficam no servidor e o app sincroniza de novo. Da 2.0 para a 3.0 nada muda nos seus eventos e agendas: aparece a aba **Tarefas** e, na primeira abertura do dia, a pergunta **"O que você pretende fazer hoje?"** (dá para desligar em **Perfil > Preferências**).
3. Se aparecer **"App não instalado"** ou **"o pacote está em conflito"**, o APK novo foi assinado com outra chave (por exemplo, a versão de testes foi trocada pela versão com chave própria). Antes de desinstalar, abra **Sincronização** e confirme que não há operações pendentes nem com erro. Confira no site que seus dados chegaram à conta. Só então desinstale a versão antiga, instale a nova e entre na mesma conta. Alterações ainda não enviadas e preferências locais podem ser perdidas.

### Como ver a versão instalada

- No app: no fim da tela **Perfil** aparece, por exemplo, "Versão 3.0.0 (build 25)". A tela **Perfil > Diagnóstico** mostra o mesmo.
- No Android: **Configurações > Apps > SynCK** (a versão aparece no final da página).

### Como desinstalar

Pressione o ícone do app por alguns segundos e toque em **Desinstalar** (ou **Configurações > Apps > SynCK > Desinstalar**).

Desinstalar **não exclui sua conta**: os dados continuam no servidor. Para excluir a conta e os dados, use antes **Perfil > Privacidade e dados > Excluir minha conta**.

## Opção B: instalação pela Google Play Store

Ainda **não disponível**. Será possível só depois que o app for publicado e aprovado pelo Google (conta de desenvolvedor, ficha da loja, política de privacidade, classificação etária e testes; veja o [GUIA_DE_DEPLOY.md, parte 5](GUIA_DE_DEPLOY.md#parte-5-google-play-store)). Quando estiver na loja, bastará procurar "SynCK" e tocar em **Instalar**, e as atualizações serão automáticas.

Se você instalou pelo APK de testes, será preciso desinstalar antes de instalar pela loja (as assinaturas são diferentes).

## Opção C: iPhone, iPad, computador ou qualquer celular (versão web)

É o mesmo app, aberto pelo navegador e instalado na tela de início. Fica com ícone próprio, abre em tela cheia, funciona sem internet depois do primeiro acesso e se atualiza sozinho. No computador, mostra menu lateral e calendário em duas colunas.

**Endereço:** <https://gustavooliveira-xxx.github.io/synck-app/> (ou o link que a pessoa responsável enviou).

> O endereço só funciona depois que a pessoa responsável publicar o site ([GUIA_DE_DEPLOY.md, parte 6](GUIA_DE_DEPLOY.md#parte-6-versão-web-iphone-ipad-computador-e-qualquer-sistema)).

### No iPhone ou iPad

1. Abra o endereço no **Safari** (em versões recentes do iOS, Chrome e Edge também funcionam).
2. Toque no botão **Compartilhar** (quadrado com uma seta para cima, embaixo no iPhone ou em cima no iPad).
3. Role a lista e toque em **Adicionar à Tela de Início**.
4. Confira o nome ("SynCK") e toque em **Adicionar**.
5. Abra pelo novo ícone **SynCK** na tela de início (não pelo Safari) e crie sua conta ou entre.
6. Para receber lembretes (iOS 16.4 ou mais novo): **Perfil > Notificações > Notificações neste navegador** e toque em **Permitir**.

### No Android (sem instalar o APK)

1. Abra o endereço no **Chrome**.
2. Toque no menu **⋮** (três pontos, no canto de cima) > **Instalar app** (ou **Adicionar à tela inicial**).
3. Confirme em **Instalar**. O ícone aparece junto dos outros apps.

### No computador

- **Chrome ou Edge (Windows, Mac, Linux):** abra o endereço e clique no ícone de **instalar** no fim da barra de endereço (um monitor com uma seta), ou no menu **⋮** > **Transmitir, salvar e compartilhar** > **Instalar página como app**. O app passa a abrir numa janela própria.
- **Safari no Mac:** menu **Arquivo** > **Adicionar ao Dock**.
- **Firefox:** use pelo navegador mesmo (salve nos favoritos); o Firefox de computador não instala sites como app.

### O que muda em relação ao app Android

- **Lembretes, alertas de tarefas e avisos chegam como notificação** depois de ativar em **Perfil > Notificações > Notificações neste navegador**. No iPhone, isso só aparece abrindo pelo ícone da Tela de Início. Mudanças feitas por outras pessoas também ficam no sino da tela **Hoje**.
- Use sempre o **ícone instalado**: o iPhone pode apagar os dados de sites que ficam muitas semanas sem uso no Safari, e isso não acontece com apps adicionados à tela de início.
- Em **computador compartilhado**, toque em **Perfil > Sair** ao terminar: os dados ficam guardados no navegador.

### Como atualizar, ver a versão e remover

- **Atualizar:** é automático. Se uma novidade não aparecer, feche o app (no iPhone, deslize ele para cima na troca de apps) e abra de novo.
- **Versão:** no fim da tela **Perfil**.
- **Remover:** pressione o ícone e toque em **Remover** ou **Apagar** (iPhone) ou **Desinstalar** (Android); no computador, abra o app e use o menu **⋮** > **Desinstalar**. Isso não exclui sua conta (use **Perfil > Privacidade e dados > Excluir minha conta** para isso).

## Problemas comuns

| Problema | O que fazer |
|---|---|
| **APK incompatível** ("O app não é compatível", "Erro de análise do pacote") | Confira se o Android é 7.0 ou mais novo. Baixe o arquivo de novo (download incompleto causa esse erro). Emuladores x86 de computador não são suportados. |
| **Espaço insuficiente** | Libere pelo menos 150 MB (apague vídeos, limpe o cache de apps em Configurações > Armazenamento) e tente de novo. |
| **Instalação bloqueada** | Refaça o passo 4 (permitir instalar apps desconhecidos para o navegador). Se o Play Protect bloquear, toque em "Mais detalhes > Instalar mesmo assim" somente se o arquivo veio da página Releases oficial. Celulares de empresa ou com controle parental podem proibir; fale com o administrador. |
| **Versão antiga** ou "App não instalado" ao atualizar | Veja [Como atualizar](#como-atualizar). Se a assinatura mudou, desinstale e instale de novo. |
| **App sem internet** | O app mostra a faixa "Sem internet. Você está vendo os dados guardados neste aparelho." Você pode ver o que já foi sincronizado e criar ou editar eventos; tudo é enviado quando a internet voltar. Veja pendências em **Perfil > Sincronização**. |
| **Notificações não recebidas** | Confira: Configurações > Apps > SynCK > Notificações (ativadas); no app, **Perfil > Notificações**; desative a otimização de bateria para o app (Configurações > Bateria). Alguns fabricantes (Xiaomi, Samsung, Motorola) encerram apps em segundo plano; procure "iniciar automaticamente" ou "apps sem restrição". Abra o app uma vez depois de reiniciar o celular. |
| **Permissão negada** (notificações) | Ative manualmente: Configurações > Apps > SynCK > Notificações. |
| **Erro de login** | Confira e-mail e senha (a senha diferencia maiúsculas). Use **Esqueci minha senha**. Depois de várias tentativas erradas, o app pede para esperar um pouco antes de tentar de novo. Se a conta foi criada mas pede confirmação, procure o código no e-mail (inclusive no spam). |
| **API indisponível** ("Sem conexão com o servidor" ou "O servidor demorou para responder") | Pode ser falta de internet ou o servidor pausado. No plano gratuito, o Supabase pausa projetos sem uso por cerca de uma semana; a pessoa responsável precisa reativar no painel ([TROUBLESHOOTING.md](TROUBLESHOOTING.md#servidor-pausado-ou-fora-do-ar)). |
| **Banco não configurado** ("Servidor não configurado" ou erros ao entrar) | O APK foi gerado sem o endereço do servidor, ou o banco ainda não recebeu as tabelas. A pessoa responsável deve seguir o [GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md) (partes 1 e 2) e gerar um APK novo. |

| **iPhone: não aparece "Adicionar à Tela de Início"** | Abra no Safari (não dentro do WhatsApp ou do Instagram, que usam um navegador próprio: toque em "Abrir no Safari"). Role a lista do botão Compartilhar até o fim. |
| **Versão web: lembrete não tocou** | É esperado nesta versão: só o app Android toca lembretes ([opção C](#o-que-muda-em-relação-ao-app-android)). |
| **Versão web: página não encontrada (404)** | O site ainda não foi publicado. A pessoa responsável deve seguir o [GUIA_DE_DEPLOY.md, parte 6](GUIA_DE_DEPLOY.md#parte-6-versão-web-iphone-ipad-computador-e-qualquer-sistema). |

Outros problemas: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
