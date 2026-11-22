# 0066. Painel da execução: chaves dos registros sob `['executions', id]` e trace por render prop

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-22
- **Quem decidiu:** orquestração (tarefa F102), com D40 da sessão global
- **Relacionadas:** ADRs 0003, 0050, 0062, 0063 (complementa a 0062 e a 0063)

## Contexto

O painel da execução (F102) lê a execução, os registros (lista paginada com filtro) e o trace de um registro. O trace é mostrado pelo `UnitRunResult`, que mora no editor, e a 0062 proíbe `executions` de importar o `editor`. Além disso, a 0063 definiu a chave `['executions', id]` para o detalhe, e invalidar essa chave sem `exact` alcançaria qualquer chave filha.

## Decisão

- **Chaves novas**, sob a execução (complemento da 0063):
  - registros: `['executions', id, 'records', filtro]`, com o filtro em objeto normalizado;
  - um registro: `['executions', id, 'record', result_key]`, com `staleTime: Infinity` (o trace não muda).
- Como `['executions', id]` é prefixo dessas chaves, a invalidação da própria execução usa `exact: true`. Quem quiser limpar tudo da execução invalida sem `exact`.
- **Trace por render prop** (complemento da 0062): `ExecutionPanel` recebe `renderRecordTrace({ trace, record })`. `executions` não importa o editor. A F104 liga a prop em `module/`, com o `UnitRunResult` (exportado por `editor/index.ts`) e uma definição v3 vazia.
- **Gaveta provisória:** sem a definição congelada, os blocos aparecem pelo id e os números como vêm da API, com a nota "Nomes e formatação chegam com a definição congelada". Sem a prop, a gaveta mostra as saídas cruas e os hashes. A F118 troca isso pela definição congelada (`GET /v1/executions/{id}/definition`), tira a nota e passa o filtro do grupo sem nó para `node_id=none`.

## Alternativas consideradas

- **`executions` importar o `UnitRunResult` do editor:** cria o ciclo que a 0062 proíbe.
- **Mover o `UnitRunResult` para `executions`:** o componente é do editor e depende dos tipos e formatadores dele.
- **Registros em chave separada (`['execution-records', id]`):** foge do prefixo único da 0063 e a invalidação por `['executions']` deixa de alcançá-los.

## Consequências

- **Bom:** um prefixo só; `executions` continua sem depender do editor; a F118 troca a gaveta sem mexer no painel.
- **Ruim:** invalidar `executionKey(id)` sem `exact` também recarrega registros. Até a F118, o trace mostra ids em vez de nomes, e fora do editor falta o CSS do unit-run.
- **A fazer:** F104 liga a render prop; F118 passa a definição congelada e importa o CSS no `UnitRunResult`.
