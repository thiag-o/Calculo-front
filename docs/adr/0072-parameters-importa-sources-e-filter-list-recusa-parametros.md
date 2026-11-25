# 0072. `editor/parameters` importa `sources` e `sources/batch-source`; `FilterList` ganha `refuseParameters`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-25
- **Quem decidiu:** orquestração (tarefa F123)
- **Relacionadas:** ADRs 0003, 0042, 0044, 0046, 0047, 0052, 0059, 0065, 0068 (complementa 0052, 0059 e 0068); `packages/react/src/editor/parameters/`, `packages/react/src/editor/sources/`, `packages/react/src/editor/sources/filters/`

## Contexto

Os valores permitidos por consulta (E7-23) pedem, dentro de um parâmetro, a busca de dataset da fonte do lote (`DatasetSearch`) e a lista de filtros da F64 (`FilterList`). As ADRs 0052, 0059 e 0068 dizem que outras sub-verticais do editor não entram nesses sentidos sem ADR nova. Além disso, o `FilterList` lê os parâmetros do rascunho por `useDraftEditor()` e os oferece sempre (`@`, **Usar parâmetro**), mas um filtro de valores permitidos não pode usar parâmetro (`parameter_in_allowed_values`).

## Decisão

- `editor/parameters` pode importar de `sources/index.ts` (o `FilterList`) e de `sources/batch-source/index.ts` (o `DatasetSearch`), e só desses pontos de entrada (ADR 0003).
- O sentido é único: `parameters` → `sources`. Nem `sources` nem `sources/batch-source` importam `parameters`, então não há ciclo novo. Quem for importar `parameters` a partir de `sources` precisa de ADR nova.
- `FilterList` e `LiteralField` (em `sources/filters`) ganham a prop opcional `refuseParameters?: string`, com o motivo a mostrar. Com ela: nenhum parâmetro é oferecido (sem lista do `@`, sem **Usar parâmetro**); um `@` digitado fica só no campo, com a mensagem, e não vai ao rascunho (ADR 0046); um `@` que já está na definição mostra o problema da análise ou o motivo. Sem a prop, o comportamento não muda.
- Outros usos que precisem recusar parâmetros usam a mesma prop, sem criar variante do componente.

## Alternativas consideradas

- **Copiar o `FilterList` para `parameters`:** duplica a regra de filtros e o tratamento de `@` (contra a ADR 0065, regra num lugar só).
- **Mover o `FilterList` e o `DatasetSearch` para uma pasta comum:** mexe em muitos arquivos de outras tarefas para um único uso novo; a 0052 e a 0059 já aceitaram importar `sources` por `index.ts`.
- **Filtrar os parâmetros fora do componente (passar o rascunho sem parâmetros):** o componente lê o rascunho direto; não há como esconder por fora.

## Consequências

- **Bom:** os filtros da consulta usam o mesmo componente, o mesmo teclado e os mesmos problemas dos filtros da fonte, sem cópia.
- **Ruim:** `parameters` passa a depender de `sources`; mudar a API de `FilterList` ou `DatasetSearch` afeta também os parâmetros. O texto do limite de 20 filtros ("A fonte aceita até 20 filtros.") é da fonte e aparece também na consulta.
- **A fazer:** se um dia `sources` precisar de algo de `parameters`, extrair a peça comum para uma pasta folha em vez de fechar o ciclo.
