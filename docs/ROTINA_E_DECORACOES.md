# Rotina e decorações

Em Perfil > Minha rotina, adicione períodos semanais. Cada período tem nome, tipo, dias, início, fim e opção de pausar. O fim anterior ao início indica término no dia seguinte; os dias selecionados indicam o início. O fuso registrado é mantido em viagens. Há até 30 períodos; turnos divididos podem usar vários.

A rotina é privada, salva nas preferências da conta e incluída na exportação de dados. Salvar exige internet; a cópia da conta já carregada participa dos cálculos offline. Não cria eventos, não envia lembretes e não impede encaixes manuais. Os intervalos ajustam Hoje, Calendário, planejador, reserva de tarefas e as sugestões de cadastro. Na busca em grupo, a rotina da própria pessoa é considerada localmente; os períodos privados de outras pessoas não são enviados.

O primeiro intervalo livre que comporta uma hora preenche um evento novo. Toques em horários da grade ou horários explícitos na adição rápida prevalecem. A edição mantém o horário original. Trocar data ou duração atualiza a lista de opções; selecionar uma mantém a duração. Sem vaga, a tela explica as alternativas e permite encaixe manual. Eventos de dia inteiro mantêm a regra existente de não ocupar a grade de horas.

O seletor Decoração oferece 12 desenhos e Sem decoração. Eventos, tarefas, lembretes, notas e hábitos usam os SVG locais de assets/icons/decor-*.svg, compilados para react-native-svg no Android. Desenhos de eventos mascarados não são devolvidos pelo servidor. Na edição de uma única ocorrência, a decoração da série é preservada.

O carregamento anima um wrapper nativo por Reanimated, sem vídeo, rede ou demora artificial. Pausa fora de foco, em segundo plano e com movimento reduzido.

## Publicação

Aplique primeiro supabase/migrations/20261103000900_rotina_decoracoes.sql. É aditiva: não remove registros e mantém compatibilidade com clientes antigos. Depois publique o site e o APK 3.4.0.
