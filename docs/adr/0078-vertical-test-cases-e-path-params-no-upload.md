# 0078. Vertical `test-cases/` depende de `executions`, chaves sob `['test-cases', …]` e `pathParams` no `client.upload`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-25
- **Quem decidiu:** orquestração (tarefa F129)
- **Relacionadas:** ADRs 0003, 0035, 0038, 0062, 0063, 0064, 0073; plano.md E7-20; F131; `packages/react/src/test-cases/`, `packages/react/src/api/client/upload.ts`

## Contexto

A F129 criou a tela **Testes** do workflow (`test-cases/`), com a seção Arquivo de referência: envio com progresso, lista, remoção e simulação comparada. Três pontos pedem regra para as próximas tarefas:

- O envio é o primeiro multipart com `{id}` no caminho (`/v1/workflows/{id}/reference-files`), e o `client.upload` da ADR 0035 só aceitava caminho literal.
- A vertical é nova e precisa de chaves de cache próprias.
- A simulação reaproveita o formulário de parâmetros, que mora em `executions`.

## Decisão

- **`pathParams` no `client.upload`** (complementa a 0035). `UploadOptions.pathParams` troca cada `{nome}` do caminho pelo valor codificado com `encodeURIComponent`. A leitura usa só propriedades próprias (`Object.hasOwn`). Valor faltante, `''`, `'.'` ou `'..'` rejeita com `TypeError` antes de enviar. Todo envio multipart com caminho parametrizado usa essa opção, sem montar o caminho à mão nem usar cast. Sem `pathParams`, o comportamento é o de antes (`/v1/excel-files`).
- **Chaves de cache sob `['test-cases', …]`**, como a 0020, 0033 e 0038 fizeram nas outras verticais: `['test-cases', workflowId, 'reference-files']` e `['test-cases', 'saved-draft', workflowId]`. O rascunho salvo é cópia própria, com `gcTime: 0`, lida direto pela API, como a 0063 faz em `executions`. `test-cases` não importa `workflows` nem `editor`.
- **Sentido `test-cases → executions`**, só por `executions/index.ts`: `ParameterForm`, `useParameterForm`, `parameterErrorsFrom`, `executionKey` e `EXECUTION_LISTS_KEY`. `executions` não importa `test-cases`. A simulação usa `useParameterForm` (modo de execução), não o modo agendamento, porque `NewSimulation.parameters` tem os mesmos valores do disparo.
- **Troca de workflow remonta a seção:** `TestCases` monta `<ReferenceFiles key={workflowId}>`. O envio em andamento é abortado no desmonte (`abort()` no cleanup de `useUploadReferenceFile`). Assim nenhuma chamada mistura o `file_id` de um workflow com o `workflowId` de outro.
- **Interface para a F131:** `<TestCases workflowId onOpenExecution />`, ambos obrigatórios.

## Alternativas consideradas

- **Cast do caminho montado para o tipo do contrato:** esconde erro de tipo e deixa cada vertical codificar o `id` por conta própria.
- **Deixar o envio seguir depois do desmonte:** ninguém acompanha, cancela ou reenvia; por isso aborta.
- **Chaves sob `['executions', …]` ou `['workflows', …]`:** misturaria a invalidação por prefixo de verticais diferentes.
- **Copiar o formulário de parâmetros para `test-cases`:** duas cópias da regra de parâmetros (a 0062 já proibiu).

## Consequências

- **Bom:** envio com caminho parametrizado tipado, codificado e protegido contra `..`. Troca de workflow sem estado antigo. Invalidação por prefixo funciona em `test-cases`.
- **Ruim:** mais uma dependência entre verticais (`test-cases → executions`); mudar o `index.ts` de `executions` pode quebrar a simulação. O `Object.hasOwn` e a recusa de `.`/`..` valem para todo `upload`.
- **A fazer:** a F131 liga a rota `/workflows/:id/tests` a `<TestCases>`, com `onOpenExecution` indo para `/executions/:id`. Se a global quiser ponto de status e atualização automática na última comparação, exportar `statusPresentation` pelo `executions/index.ts` (manutenção).
