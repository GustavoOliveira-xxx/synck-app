# Revisão de produto do SynCK 3.5.0

Base funcional: 7baaf67, com os guias atualizados em 46a01f5. Revisão de 4 de novembro de 2026. O caso mais urgente está no compartilhamento de blocos e notas. Uma pessoa pode ter permissão para criar os dois registros e, ainda assim, o público de um deles ser maior que o público do outro.

## Como a revisão foi feita

Inventário de 357 arquivos de fonte, testes e documentação, incluindo as dez migrations em ordem, app-mobile/src, SQL dos testes, função de Web Push, testes de navegador, decisões, modelo, regras e roteiro de telas. A leitura por domínio seguiu a tela, a operação offline ou RPC, a regra efetiva mais recente no banco e a representação devolvida ao leitor. O [índice técnico](REVISAO_3.5_INDICE.md) localiza as definições e as suítes. Um inventário estático não comprova execução de cada ramo.

No commit do aplicativo passaram 239 testes do app, 98 de banco, 16 de telas e sete de instalação web. Para esta revisão também foram executados os sete exemplos de rotina, quatro frases de cadastro rápido e dois contraexemplos do planejador. A privacidade foi reproduzida com usuários fictícios em PGlite, utilizando as migrations do repositório. Testes físicos de notificação com a tela bloqueada e o aplicativo encerrado continuam pendentes.

## Achados que mudam uma decisão do usuário

| Classificação | Situação e consequência | Evidência e critério de correção |
|---|---|---|
| Defeito confirmado | Uma tarefa pessoal pode originar um bloco de execução em uma agenda compartilhada. O planejador copia seu título e grava o bloco com visibilidade de membros. Um visualizador consegue inferir a atividade particular. | PlannerScreen.tsx, função reserve; trigger de events.task_id; list_events. Na reprodução, Davi não recebeu a tarefa, mas recebeu o bloco com título e identificador da tarefa. Exigir teste de leitura por terceiros, inclusive por API, antes de liberar esse caminho para equipes. |
| Defeito confirmado | Uma nota de agenda pode devolver o identificador de uma tarefa pessoal ao leitor da nota. Validar o acesso de quem cria o vínculo não garante a privacidade de quem lê. | Na mesma reprodução, list_my_items de Davi devolveu a nota com task_id pessoal. O destino deve ser omitido em toda leitura sem autorização, inclusive exportação e cache. |
| Defeito confirmado | O planejador aceita uma vaga antes da data de início da tarefa. | Execução de planWeek com início e prazo em 06/11 e vaga em 04/11 às 12h UTC: sugeriu 04/11. Aplicar a data inicial no fuso da tarefa antes de distribuir os blocos. |
| Defeito confirmado frente à regra solicitada | Uma tarefa vencida recebe uma sugestão posterior ao prazo. Essa é uma regra deliberada da versão 3.5.0. | Tarefa vencida em 03/11 com janela iniciada em 04/11: planWeek sugeriu 04/11. Oferecer replanejamento explícito do atraso e distinguir isso de uma sugestão que atende ao prazo. |
| Implementado parcialmente | O histórico de conclusão da tarefa recorrente permanece, mas a próxima ocorrência reutiliza e desmarca o checklist. | apply_task_op na migration de decorações e teste de recorrência em 10_tarefas. A conclusão armazena data e pessoa; o reset limpa done, done_at e done_by. Reabrir não recompõe a fotografia das etapas da ocorrência anterior. |
| Implementado parcialmente | Uma enquete encerrada guarda event_id e chosen_option_id. A tela continua mostrando o horário da opção votada. | close_poll e PollsScreen. Apresentar o resultado histórico da votação separado do horário e estado atuais do evento, consultados com a permissão de quem vê. |
| Melhoria de coerência | A reunião das 10h dentro do próprio expediente produz o mesmo aviso que uma consulta médica às 10h. | routineGuard compara intervalos. O tipo do evento, sua cor e o texto do título não comprovam que ele pertence àquele expediente. |

**Ordem de trabalho sugerida.** Primeiro proteger escrita e leitura dos vínculos e testar com dois leitores de permissões diferentes. Em seguida corrigir limites de início, prazo e disponibilidade das propostas. Só então introduzir contexto pessoal opcional. Uma nova tabela genérica de relações não resolveria os dois primeiros problemas.

## Minha rotina: sete casos e seus efeitos

O cadastro guarda períodos no JSON privado da preferência da conta. O banco valida o formato e a RPC compara a versão lida com o conteúdo atual antes de salvar. A projeção cria blocos virtuais para Hoje e Calendário. A mesma rotina alimenta useFreeSlots. Um período desabilitado permanece no cadastro e deixa de reservar horas. Alterações de rotina não reescrevem eventos gravados.

| Caso | Resultado da revisão | Classificação |
|---|---|---|
| A. Expediente passa de 08–17 para 09–18 | Alterar o padrão substitui os horários semanais; a terça às 08h30 deixou de colidir. O modelo não tem vigência inicial/final para preservar um padrão histórico a partir de determinada data. | Implementado parcialmente |
| B. Só na terça, 10–19 | Uma exceção identificada pela data original liberou terça às 08h30 e manteve quarta às 08h30 ocupada. Há fluxo para restaurar o padrão e proteção contra atualização concorrente. | Implementado e validado |
| C. Trabalho e escola | Dois períodos independentes. Às 22h locais o cálculo encontrou apenas a escola. Escola funciona sem aula, prova, tarefa ou hábito associado. | Implementado e validado no cálculo |
| D. Dois períodos coincidentes | O cálculo devolveu os dois IDs. A união de intervalos ocupa a faixa uma vez, mas o cadastro semanal valida cada período isoladamente. A confirmação do cadastro de um evento não cobre a edição do padrão semanal. | Implementado parcialmente |
| E. Turno 22–06 | Às 03h locais do dia seguinte, o cálculo encontrou o turno do dia anterior. Uma liberação usa a data em que o turno começou. | Implementado e validado |
| F. Pausar e reativar | Para a mesma data, a pausa retornou zero blocos e a reativação voltou a retornar o período. | Implementado e validado no cálculo |
| G. Fuso | A mesma hora UTC caiu fora do expediente em São Paulo e dentro de um período em UTC. A tela usa o fuso da pessoa ao criar e mostra o fuso do período; não oferece seletor para mudá-lo depois. | Implementado parcialmente |

Edição permanente, exceção única e reagendamento têm efeitos diferentes. Os testes em routine.test.ts e 12_rotina_excecoes_conclusao verificam meia-noite, exceções inválidas, duplicatas, concorrência e série. Alterar o fuso com mudança de horário de verão e restaurar exceções depois de mudar os dias da semana ainda merecem testes de interface. A exclusão remove o período com suas exceções; atualmente nenhum evento ou hábito depende desse ID. Se futuramente existir vínculo, remover o período deve soltar o vínculo e preservar o item.

## O que pertence ao trabalho

| Relação | Representação adequada hoje | Limite |
|---|---|---|
| Contexto semântico | work, school, exercise e outros tipos já dão vocabulário à rotina. Etiquetas podem classificar tarefas. | Ausente como classificação pessoal transversal a evento, tarefa e nota. Um ID de agenda concede participação e não substitui contexto privado. |
| Hierarquia | Checklist pertence a uma tarefa. | Item tem marcação, mas não é uma tarefa com prazo e alertas próprios. |
| Dependência de execução | Ausente como relação explícita entre tarefas. | O cenário não exige um grafo de dependências; não criar arestas, ciclos ou bloqueios por inferência de texto. |
| Reserva de horário | events.task_id liga uma ou mais reservas a uma tarefa. | O prazo continua na tarefa. Corrigir a exposição entre públicos antes de incentivar múltiplos vínculos. |
| Referência informativa | notes.event_id e notes.task_id já existem. | O editor comum permite escolher agenda, mas não oferece um editor geral desses vínculos. A criação deve verificar ambos os lados e a leitura também. |

Para a reunião de quarta às 10h, o relatório até sexta e as notas sobre o emprego, a primeira experiência a testar é uma classificação privada opcional que reutilize o vocabulário da rotina. O usuário escolhe Trabalho explicitamente. Um filtro reúne os registros com seus horários, prazos e ações próprios. Uma reunião confirmada como parte do expediente pode caber dentro dele; outra reunião real simultânea continua ocupada. Uma consulta médica de outro contexto pede decisão. Uma tarefa de relatório só ocupa tempo quando tem um bloco reservado. Concluir a tarefa preserva o expediente.

A classificação por pessoa é necessária porque dois participantes da mesma reunião podem classificá-la de modos diferentes. Um campo público no evento exporia essa escolha. Antes de criar armazenamento, testar a navegação e definir remoção de membro, exclusão do alvo e sincronização. Só persistir associações com dono explícito e alvos válidos e visíveis, sem acesso transitivo e sem transformar associação em hierarquia. Escola pode continuar só um horário. Um treino e uma nota de evolução podem ser classificados como atividade física sem criar um hábito obrigatório.

## Auditoria por domínio

**Eventos — implementado e validado no núcleo.** 04_eventos e 05_sincronizacao cobrem criação, autor real, papéis, edição, sobreposição, exclusão lógica, restauração, status, comentários, participantes e lembretes pessoais. O modelo distingue responsável e lista de participantes. A resposta de presença é feita no detalhe; marcar presença não equivale a concluir o evento. Datas locais de eventos de dia inteiro e instantes de eventos com hora seguem caminhos diferentes. A duração do expediente não muda ao incluir reunião. O cálculo de disponibilidade exclui eventos de dia inteiro segundo a regra vigente; quem os usa para férias precisará de uma decisão explícita de indisponibilidade.

Recorrências são expandidas com exceções por data original. Cancelar uma segunda-feira usa a exceção da ocorrência, mantendo a regra da série. Conclusão rápida simples ou por ocorrência tem teste próprio; comentário, duplicação, histórico e lembrete têm identidade separada. A duplicação deve ser testada com exceção concluída e leitor mascarado. Importação/exportação ICS é parcial: o exportador emite UID, RRULE e EXDATE; o importador ignora VEVENT com RECURRENCE-ID. Um arquivo com edição destacada de uma ocorrência não tem garantia de ida e volta sem perda.

**Tarefas — implementado e validado no núcleo.** Prazo com ou sem hora, início, responsável, participantes, estimativa, prioridade, etiquetas, listas e agenda são atributos distintos. Uma tarefa pessoal pode existir sem agenda compartilhada. A conclusão recorrente por calendário usa a sequência prevista; após conclusão, a próxima data conta a partir da realização. Os testes de replay, histórico, reabertura, exclusão/restauração e transferência entre listas verificam partes diferentes desse contrato. Um prazo sem hora não torna o dia indisponível. Um prazo com hora é checado como instante, enquanto a duração é reservada por evento.

**Etapa que cresceu — melhoria de coerência.** Criar uma tarefa completa para a etapa que ganhou responsável, prazo e lembrete. A promoção direta com rastreio da etapa de origem está ausente. Antes de implementá-la, exigir que o usuário confirme o destino, conservar o checklist simples para as demais etapas e tornar o ato idempotente. Se for necessário auditar etapas por ocorrência, guardar a fotografia na conclusão antes de zerar as marcações.

**Blocos de execução e planejador — parcialmente implementados.** Não há unicidade de task_id nos eventos. Duas reservas podem atender à mesma tarefa. Alterar ou concluir um evento opera sobre o evento; o teste de bloco confirma que excluir o bloco preserva a tarefa. A chave estrangeira usa ON DELETE SET NULL na exclusão física, enquanto a lixeira usa exclusão lógica. Na reprodução com duas reservas, ambas permaneceram ativas na lixeira da tarefa; restaurar recuperou a tarefa com o prazo original de 06/11. O vínculo se refere à tarefa, sem identificar a ocorrência de uma tarefa recorrente. Testar explicitamente duas reservas, avanço de prazo, restauração e histórico antes de exibir “tempo dedicado a esta ocorrência”.

useFreeSlots combina eventos relevantes e routineBusy dentro da janela do usuário. A proposta divide tarefas longas e só aceita a alocação se todos os trechos couberem na simulação. A tela exige confirmação para gravar. Ela consome slots sem consultar o indicador complete retornado pelo hook; uma janela ainda incompleta não pode ser apresentada como comprovadamente livre. O laço grava bloco por bloco; uma falha intermediária pode deixar parte da seleção na fila. Validação suficiente ainda falta para interrupção, repetição e conflito surgido entre revisar e confirmar. Mostrar os blocos que realmente foram aceitos e reconciliar o restante antes de repetir.

**Hábitos — implementados e validados para realização individual.** A chave de registro distingue hábito, usuário e dia. A operação de marcar usa auth.uid(), e o teste com agenda compartilhada verifica independência entre participantes. A interface distingue ativo, pausado e arquivado. dailyPlan usa regra e registros para frequência, sequência e sugestões de hoje. Alterar a regra atual pode mudar a interpretação retrospectiva de dias esperados; falta validação específica de sequência antes/depois da alteração. Ler por 30 minutos pode ser um hábito diário; o expediente é disponibilidade e dispensa marcação. Nenhuma fusão é necessária.

**Notas — parcialmente implementadas.** Corpo, título opcional, fixação, agenda e destino informativo são conceitos separados. Uma nota pessoal sobre trabalho pode existir sem apontar para reunião. O modelo SQL aceita a reunião como referência da nota; o editor comum cria a nota com sua agenda. SQL permite referência a evento ou tarefa, exclusão lógica e restauração. O editor de nota não expõe todos os relacionamentos suportados pelo banco. Busca e mural precisam respeitar a mesma visibilidade da leitura por ID. Uma linha de atividade não é um histórico completo do texto. A necessidade de associar diretamente nota a hábito ou período não está demonstrada; classificação pessoal pode atender à nota geral sobre emprego ou evolução.

**Lembretes e dispositivos — implementados sem validação suficiente de entrega.** Lembrete avulso usa o modelo de item com tipo reminder. Alertas de tarefa pertencem à tarefa e lembretes de evento ao compromisso. Um alerta do prazo de sexta e outro da sessão de quarta têm finalidades válidas. Não deduplicar só por título ou hora. O serviço nativo recalcula agendamentos, conserva adiamentos ativos e trata ação de concluir tarefa. O Web Push usa uma função separada e considera exceção de ocorrência concluída. O agendador de produção retornou HTTP 200 em 16 execuções da versão nova na amostra observada; isso comprova resposta do serviço, não exibição de uma notificação ao destinatário.

Teste físico pendente: conceder e revogar permissão, bloquear a tela, fechar o app, atravessar horário silencioso, adiar, mover, cancelar, excluir e concluir. Registrar se o alerta antigo desapareceu e o novo chegou uma única vez. Repetir com PWA instalada em iPhone e navegador de computador. Para itens relacionados, concluir um bloco deve cancelar apenas seus lembretes aplicáveis.

**Agendas e acesso — implementado e validado nas operações cobertas, com defeito confirmado nos vínculos.** 02_agendas_membros, 03_convites, 04_eventos, 06_privacidade_busca e 10_tarefas distinguem proprietário, administrador, editor, colaborador, visualizador e pessoa de fora. Transferência de propriedade, aceite e remoção têm caminhos próprios. A privacidade efetiva depende também de criador, responsável, participação e estado da agenda. Permissão de ver o evento não autoriza ver a tarefa de origem. Avaliar leitura direta, listagens, exportação, comentários, histórico, notificações e cache depois de remover um membro. Repetir a matriz para agenda arquivada e na lixeira. A cobertura atual das entidades isoladas não comprova segurança de toda combinação.

**Enquetes — parcialmente implementadas.** A seleção de participantes e opções, votos, prazo, encerramento e criação opcional do evento passam por funções próprias. O teste multissessão confirma voto permitido, fechamento e recusa de voto posterior. Na reprodução, a opção selecionada ficou em 12/11 às 19h e a remarcação do evento para 19/11 às 09h foi aceita. A tela usa a data da opção original. O vínculo ao evento foi preservado, mas a tela não distingue horário votado do horário vigente. Para saber o horário definitivo, mostrar o evento atual apenas a quem pode lê-lo. Se ele foi cancelado ou excluído, refletir o estado sem divulgar o motivo privado. Reabertura offline, perda de acesso após voto e mudança posterior do evento precisam de testes específicos.

## Cadastro rápido reproduzido

Data de referência: quarta-feira, 04/11/2026. As quatro frases foram executadas no parser da versão publicada.

| Entrada | Resultado |
|---|---|
| Reunião com Paulo terça das 14h às 15h | Evento em 10/11, 14h–15h |
| Entregar relatório até sexta-feira | Tarefa com prazo em 06/11, sem horário |
| Pagar conta todo dia 10 | Tarefa com primeira data em 10/11 e recorrência mensal no dia 10 |
| Conversar com o gestor sobre promoção | Tarefa sem data. A frase por si só não estabelece uma reunião marcada. |

O texto do gestor tampouco autoriza compartilhar a atividade ou vinculá-la ao expediente. A pessoa pode escolher seu contexto ao revisar o cadastro.

## Documentação e decisão de liberação

O CHANGELOG de 3.4 e 3.5 e ROTINA_E_DECORACOES descrevem desenhos, sugestões, exceções e conclusão por ocorrência. MODELO_DE_DADOS, REGRAS_DE_NEGOCIO e os roteiros históricos de 3.0 devem ser lidos junto das migrations mais novas. Faltam exemplos de leitura por terceiros em vínculos, um contrato de checklist por ocorrência, tratamento de prazo vencido e distinção entre enquete encerrada e evento vigente. A menção histórica de ICS ou Web Push como trabalho futuro não reflete o importador e a função presentes no repositório.

Para uso pessoal, a rotina privada, as exceções e as sugestões já cobrem os exemplos básicos. Para recomendar planejamento de tarefas pessoais **em agendas compartilhadas**, corrigir e testar primeiro a exposição entre públicos. Publicar um APK com assinatura própria comprova a identidade da distribuição; o teste físico e as correções de privacidade são verificações separadas.
