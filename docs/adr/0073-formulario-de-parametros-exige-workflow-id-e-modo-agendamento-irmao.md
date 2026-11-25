# 0073. Formulário de parâmetros exige `workflowId` e o modo agendamento é um controlador irmão

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-25
- **Quem decidiu:** orquestração (tarefa F124)
- **Relacionadas:** ADRs 0062, 0063; plano.md E7-23, E7-24; F128, F129; `packages/react/src/executions/index.ts`, `packages/react/src/executions/parameter-form/`

## Contexto

A ADR 0062 exporta `useParameterForm` de `executions/index.ts` para o disparo e para o editor. Na F124 os parâmetros ganharam valores permitidos por consulta (E7-23), e a rota que lista esses valores é do workflow (`workflowId`). O formulário também ganhou o modo agendamento (E7-24), que lê e grava os parâmetros de forma diferente do disparo. A F128 vai usar esse modo (a F129 usa o modo de execução).

## Decisão

- `useParameterForm` passa a exigir `{ workflowId, initial? }`. Quem usa o formulário (disparo, editor) informa o workflow.
- O modo agendamento é um controlador irmão, `useScheduleParameterForm(parameters, { workflowId, initial? })`, com `formProps.mode = 'schedule'`. Não é uma flag no `read()` do outro.
- `executions/index.ts` exporta também `useScheduleParameterForm`, `readScheduleParameters`, `scheduleFormValues` e `relativesFor`. Para retomar um agendamento salvo, use `initial: scheduleFormValues(parameters, schedule.parameters)`.
- Cada modo tem seu tipo de leitura (`ParametersReading` e `ScheduleParametersReading`).
- As regras da 0062 seguem: o editor só importa nomes de `executions/index.ts`, e `executions` não importa o editor.

## Alternativas consideradas

- **`workflowId` opcional:** o campo de consulta quebraria só em tempo de execução. Exigir no tipo acusa na compilação.
- **Uma flag `schedule` no `read()` do mesmo controlador:** o resultado teria dois formatos num tipo só, e quem lê precisaria checar o modo.
- **Receber a busca de valores por props, sem `workflowId`:** cada tela repetiria a ligação com a API.

## Consequências

- **Bom:** erro de compilação se faltar o workflow. O tipo de leitura de cada modo é claro. F128 e F129 têm um contrato fixo.
- **Ruim:** quem já chamava `useParameterForm()` precisa passar o `workflowId` (o editor foi ajustado na F124). Dois controladores para manter em paralelo.
- **A fazer:** a F128 usa `useScheduleParameterForm` como descrito acima. Correção da F129: ela usa `useParameterForm` (modo de execução), porque o corpo da simulação tem os mesmos valores do disparo, não `{kind, value}` (ver [0078](0078-vertical-test-cases-e-path-params-no-upload.md)).
