# Rotina, exceções e agenda

## Decisão de produto — 3.5.0

O padrão semanal e a exceção de uma data são registros separados. A rotina é privada e aparece como blocos discretos em Hoje e Calendário (mês, semana, dia, lista e quadro). Não cria cópias de eventos compartilhados, notificações extras nem tarefas atrasadas.

Ao cadastrar ou mover um evento, tarefa ou lembrete com horário, uma sobreposição com a rotina exige decisão: escolher outro horário, liberar as ocorrências envolvidas ou confirmar que deseja manter os dois. O cancelamento mantém o formulário. Os períodos são fechados no início e abertos no fim: terminar às 12h permite começar outro item às 12h.

Uma tarefa sem horário é um prazo, não uma reserva de tempo. Uma tarefa com horário verifica aquele instante; para reservar sua duração, use o bloco de tempo existente. Eventos de dia inteiro continuam seguindo a regra do produto e não ocupam todas as horas. Não alteramos compromissos existentes automaticamente. Conflitos surgidos depois de uma alteração de rotina ficam visíveis na agenda.

Uma série exige confirmação explícita com aviso sobre ocorrências futuras; liberar uma data não libera a série. Não prometemos que uma repetição ilimitada está sem conflitos só por seu primeiro dia estar livre. A checagem usa a rotina disponível no aparelho; alterações de outro dispositivo chegam pela sincronização.

## Um dia diferente

Toque no bloco. “Não vou neste dia” libera somente a ocorrência selecionada. Exemplo: liberar a academia de terça permite estudar nesse horário, sem apagar a academia das próximas terças. “Reagendar só esta ocorrência” mantém o padrão e move apenas aquela data, inclusive para outra semana. A tela informa se o destino coincide com outro compromisso. “Restaurar padrão” remove a exceção, também conferindo sobreposição. Em Minha rotina, a lista de exceções permite recuperar um dia que foi liberado.

Turnos noturnos pertencem ao dia em que começam. Liberar domingo 23h–7h também libera a manhã de segunda. O fuso da rotina é preservado em viagens. Alterar o padrão semanal preserva as exceções; pausar oculta e deixa de reservar o período. Apagar remove o período e suas exceções.

Salvar a rotina ou exceções exige internet e compara o estado original com o servidor: uma edição antiga não sobrescreve silenciosamente a mudança de outro aparelho. A conta mantém uma cópia para consulta e cálculo offline. As exceções liberadas são salvas como uma ação independente antes de cadastrar o compromisso, mesmo que a pessoa depois desista do cadastro. Limite: 30 períodos e 730 exceções por período.

## Decoração e conclusão

As 12 decorações SVG locais continuam disponíveis em eventos, tarefas, lembretes, notas e hábitos, inclusive no Android offline. Desenhos e exceções de eventos mascarados seguem as permissões existentes.

A ação de concluir aparece na lista e em destaque nos detalhes, apenas para quem pode editar. Em evento recorrente, conclui só aquela ocorrência. Desfazer/reabrir preserva as próximas ocorrências e os outros campos da exceção.

## Carregamento

Ao abrir uma página, voltar ou mudar de aba, o Kairo aparece no centro da tela por 650 ms e cobre também o cabeçalho e a navegação. Se a página precisar de mais tempo para carregar dados, a mesma tela acompanha a espera. Após dois segundos, “Mostrar página” permite acessar os controles já disponíveis enquanto os dados chegam. Tocar na aba atual mantém a tela em repouso. A preferência por movimento reduzido mantém o Kairo estático.

## Pesquisa que orientou as decisões

Consultada em 03/11/2026:
- Google Calendar: editar uma ocorrência ou o conjunto de eventos recorrentes: https://support.google.com/calendar/answer/37115?hl=en
- Reclaim: distinguir rotina e ocorrência; pular, reagendar e manter uma preferência manual: https://help.reclaim.ai/en/articles/17124978-habit-agent-overview-automate-recurring-routines
- Nielsen Norman Group: feedback proporcional ao tempo de resposta, sem atrapalhar respostas rápidas: https://www.nngroup.com/articles/response-times-3-important-limits/
- Material Design: indicar espera real e evitar indicadores duplicados para a mesma operação: https://m1.material.io/components/progress-activity.html

O synCK adota decisões explícitas para mudanças de horário; não move automaticamente compromissos do usuário.
