# 0075. Sub-vertical `executions/comparison/` importa `api` e `records`, e `detail` importa `comparison`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-25
- **Quem decidiu:** orquestração (tarefa F127)
- **Relacionadas:** plano E7-20, ADRs 0003, 0063, 0066 (complementa a 0063 e a 0066)

## Contexto

A F127 mostra, no painel da simulação, a comparação com o arquivo de referência (resumo, contagens e diff por registro). A seção precisa da peça comum `executions/api/` e da gaveta do trace em `executions/records/`, e o painel (`detail/`) precisa incluí-la. Isso cria arestas novas entre sub-verticais de `executions`, que a 0063 e a 0066 não cobrem.

## Decisão

- Nova sub-vertical `executions/comparison/`, prevista na E7-20.
- Sentido único: `comparison -> api` (`executionKey`, `isRunning`), `comparison -> records` (`RecordTraceDrawer`, `recordKeyText`, `RECORD_STATUS`) e `detail -> comparison`. `records` e `api` não importam `comparison`; sem ciclo.
- A consulta fica na própria sub-vertical, em `comparison/queries.ts` (`useComparisonRecords`), como `list/queries.ts` e `trigger/queries.ts`.
- Chave sob o prefixo da execução (0063 e 0066): `['executions', id, 'comparison', { outcomes }]`, com `staleTime: Infinity` (o diff gravado não muda). Vale a regra do `exact` da 0066 para invalidar a execução.
- Padrão para as próximas: sub-vertical nova de `executions` tem a consulta em `queries.ts` e a chave sob `['executions', id, …]`.

## Alternativas consideradas

- **Colocar a seção dentro de `detail/`:** incha o painel e mistura a consulta do diff com a do painel.
- **Pôr a consulta em `api/`:** `api/` é só rotas, chaves e apresentação de status; consultas por tela ficam com a tela.
- **Chave fora de `['executions', id]`:** foge do prefixo único da 0063.

## Consequências

- **Bom:** a comparação isolada e testável; um prefixo só para invalidar.
- **Ruim:** `comparison` depende da API pública de `records`; mudar `RecordTraceDrawer` exige olhar as duas.
- **A fazer:** o lint de fronteiras deve manter o sentido `detail -> comparison -> records` e proibir o contrário.
