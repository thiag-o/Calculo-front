# 0063. `executions` lê workflows direto pela API, com chaves próprias, e `executions/api/` é a peça comum das sub-verticais

- **Status:** aceita, revisar no checkpoint (complementada por [0066](0066-painel-da-execucao-chaves-de-registros-e-render-prop-do-trace.md), que na F118 acrescenta a chave `['executions', id, 'definition']`)
- **Data:** 2026-11-22
- **Quem decidiu:** orquestração (tarefa F101), com aprovação da sessão global
- **Relacionadas:** ADRs 0003, 0020, 0033, 0038, 0062 (complementa a 0062)

## Contexto

A lista e o disparo de execuções (F101) precisam de dois dados de workflows: a lista de workflows (para escolher e filtrar) e o rascunho salvo (para montar os parâmetros). A 0062 só permitia `editor -> executions` e proibia `executions -> editor`. Não dizia nada sobre `workflows`. Além disso, a lista, o disparo e o painel da F102 (sub-verticais de `executions`) compartilham rotas, chaves de cache e a apresentação dos status.

## Decisão

- **Sentido entre verticais:** `workflows -> executions` é permitido (já existe via `renderEditor` e o formulário, 0050 e 0062). `executions -> workflows` **não** é permitido, nem pelo `index.ts`.
- `executions` lê `GET /v1/workflows` e `GET /v1/workflows/{id}/draft` direto pela API (ADR 0008), sem importar hooks ou chaves de `workflows`.
- Chaves próprias, todas sob `['executions', …]` (como as 0020, 0033 e 0038):
  - lista: `['executions','list',filtro]` (filtro em objeto normalizado);
  - detalhe: `['executions',id]`;
  - rascunho salvo: `['executions','saved-draft',id]`, com `gcTime: 0`;
  - opções de workflow: `['executions','workflow-options']`.
- `executions/api/` é a peça comum das sub-verticais (lista, disparo, painel da F102): rotas, chaves de cache e `STATUS_PRESENTATION`. As sub-verticais importam dela; ela não importa de nenhuma sub-vertical.
- O rascunho salvo sob `executions` é copiado à parte do de `workflows`; o `gcTime: 0` limita o tempo em que fica desatualizado.

## Alternativas consideradas

- **`executions` importar de `workflows`:** cria ciclo com `workflows -> executions`.
- **Reaproveitar as chaves `['workflows', …]`:** exige a dependência proibida, e os dois lados passariam a depender do formato um do outro.
- **Cada sub-vertical com suas rotas e chaves:** o status e as chaves divergiriam, e invalidar pelo prefixo `['executions']` ficaria incerto.

## Consequências

- **Bom:** sem ciclo; um prefixo só para invalidar execuções; status apresentado igual na lista, no disparo e no painel.
- **Ruim:** a exclusão de workflow (ADR 0038) remove só `['workflows',id,…]`. O rascunho em `['executions','saved-draft',id]` e as opções em `['executions','workflow-options']` **não são limpos** por ela. O `gcTime: 0` do rascunho reduz o risco, mas as opções podem mostrar um workflow já excluído até a próxima busca. Dois caminhos leem o mesmo endpoint.
- **A fazer:** se isso incomodar, `useDeleteWorkflow` não pode importar `executions` por esse lado; avaliar invalidar por evento ou aceitar o atraso. Reforçar no lint o sentido `executions -> workflows` proibido.
