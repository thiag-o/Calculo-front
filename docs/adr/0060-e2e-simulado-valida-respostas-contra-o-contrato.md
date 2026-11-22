# 0060. E2e simulado valida as respostas da API simulada contra o esquema do contrato

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-22
- **Quem decidiu:** orquestração (tarefa F112)
- **Relacionadas:** ADR 0005 (tipos pelo OpenAPI), 0029 (e2e por épico e contrato único), 0030 (simulação por glob)

## Contexto

A API simulada dos e2e devolvia `row_key: {}` num trace, o que o contrato proíbe (`RecordKey.minProperties: 1`; o valor real é `null` num bloco Fonte sem ligação). Os e2e simulados passavam, e só o modo real quebrava (`TypeError` em `UnitRunResult`). Até aqui só os exemplos de erro eram conferidos com o `openapi.yaml` (ADR 0029), não as respostas que as simulações montam.

## Decisão

- A fixture base (`e2e/support/fixtures.ts`), no modo simulado, lê as respostas das rotas listadas em `VALIDATED_ROUTES` (`e2e/support/contract-schema.ts`) e valida status declarado, tipo de conteúdo e esquema contra o `openapi.yaml`. Se houver violação, o teste falha com a lista delas.
- Hoje a lista tem `POST …/draft/unit-runs` e `POST …/draft/previews`. Rota nova de simulação com resposta estruturada entra na lista na tarefa que a criar.
- O validador usa o Ajv 2020 que já vem com o openapi-typescript (`@redocly/ajv`). Não se acrescenta dependência.
- O contrato é lido de `FLUXO_BACKEND_DIR` ou `../backend`, como o `contract-examples`. Com a variável definida e o arquivo ausente, falha.
- `contract-schema.spec.ts` prova que exemplos do contrato passam e que respostas fora dele são recusadas.

## Alternativas consideradas

- **Só conferir no modo real:** acha o erro tarde e depende do back no ar. Descartada.
- **Validar todas as rotas de uma vez:** as simulações antigas têm respostas parciais e o custo de corrigir tudo é alto. Descartada; entra por rota.
- **Dependência nova de validação (ajv próprio, zod):** duplica o que o gerador já traz. Descartada.

## Consequências

- **Bom:** simulação fora do contrato é pega no e2e simulado, antes do modo real.
- **Ruim:** o e2e simulado passa a precisar do `openapi.yaml` do back; acoplamento ao Ajv transitivo do gerador (uma troca dele pede ajuste aqui).
- **A fazer:** ao incluir uma rota em `VALIDATED_ROUTES`, corrigir as simulações dos épicos que a usam.
