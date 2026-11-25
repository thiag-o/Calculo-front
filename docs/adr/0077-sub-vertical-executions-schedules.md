# 0077. Sub-vertical `executions/schedules/`: lista única, chaves próprias, datas no fuso do agendamento

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-25
- **Quem decidiu:** orquestração (tarefa F128)
- **Relacionadas:** plano E7-24, ADRs 0003, 0062, 0063, 0073, 0075 (complementa a 0063)

## Contexto

A F128 traz os agendamentos para `executions`. A mesma lista serve a tela global e a aba do workflow, e a Visão geral precisa de "Próxima execução". O contrato não traz o fuso fora de um `Schedule` e não tem rota com a definição congelada de um agendamento. A decisão fecha as arestas entre sub-verticais, as chaves de cache e dois desvios do contrato.

## Decisão

- Nova sub-vertical `executions/schedules/`, exportada por `executions/index.ts` (`ScheduleList`, `ScheduleDialog`, `NextScheduledRun`, `recurrenceText`, `SCHEDULES_KEY`, `scheduleListKey`, tipos e `EXECUTIONS_SCHEDULE_PERMISSION`).
- `ScheduleList` é um componente só. Com `workflowId`, o filtro é fixo e a coluna Workflow some. Sem ele, é a lista do tenant.
- Sentido único: `schedules -> api`, `schedules -> list` (`parametersSummary`, `useNarrowModule`) e `schedules -> parameters` (`useScheduleParameterForm`, ADR 0073). Nenhuma delas importa `schedules`.
- Chaves sob `['executions', 'schedules', …]`: `list` com `{workflowId}` e `saved-draft` com o id (`gcTime: 0`, o rascunho salvo é lido a cada abertura). `NextScheduledRun` usa a chave da lista do workflow (no máximo 20 agendamentos, a primeira página tem todos). Switch e edição gravam o agendamento devolvido nas listas e invalidam as listas.
- Datas do agendamento (próxima execução, último disparo) aparecem no fuso de `schedule.timezone`, nunca no do navegador, para bater com o horário da recorrência. Padrão para telas que mostrem horário de agendamento.
- Lacunas do contrato, resolvidas assim até o back mudar (resposta D46, opção A):
  - Novo agendamento usa o fuso do primeiro agendamento carregado. Sem nenhum, mostra "Horário do fuso configurado no sistema".
  - Ao editar com a revisão desatualizada, o formulário de parâmetros usa a declaração do rascunho salvo atual. Se divergir da revisão congelada, o back devolve `422` e o erro aparece no campo ou na nota.

## Alternativas consideradas

- **Lista separada para global e para workflow:** duplica colunas, paginação e erros.
- **Datas no fuso do navegador:** o horário mostrado difere da recorrência configurada.
- **Back expõe o fuso (sessão ou `ScheduleList`):** melhor, mas é tarefa de contrato fora da F128.
- **`GET /v1/schedules/{id}/definition` para a declaração congelada, ou parâmetros só leitura até "Usar a revisão atual":** ficam como saída se o `422` incomodar.

## Consequências

- **Bom:** uma lista, um prefixo de cache, o horário sempre coerente com a recorrência.
- **Ruim:** o fuso do primeiro agendamento é um paliativo. A declaração atual pode divergir da congelada ao editar, e o aviso só vem do `422`.
- **A fazer:** pedir ao back o fuso exposto e, se for o caso, a rota da definição congelada do agendamento. A F131 liga `ScheduleList` às rotas e `NextScheduledRun` à Visão geral.
