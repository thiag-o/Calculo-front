# 0059. O canvas importa `sources/batch-source`, e o `PropertiesPanel` recebe as peças de fontes e grupos por render props

- **Status:** aceita, revisar no checkpoint (complementada por [0061](0061-editor-definition-folha-com-leituras-puras-da-definicao.md): o canvas também importa `sources/source-block`, só por `sources/index.ts`)
- **Data:** 2026-11-21
- **Quem decidiu:** orquestração (tarefa F69, D21 e D29)
- **Relacionadas:** ADRs 0003, 0042, 0044, 0047, 0052, 0057 (complementa 0052 e 0057); `packages/react/src/editor/canvas/`, `properties/PropertiesPanel.tsx`, `Editor.tsx`

## Contexto

Na F69 o editor junta fontes, grupos e prévia. Dois pontos não estavam cobertos:

- O canvas precisa desenhar a `BatchSourceBar` e usar o `DatasetSearch` (no `NewSourceDialog`), que vivem em `sources/batch-source`. A 0057 só fixa o sentido canvas → unit-run → preview → values, e a 0052 só abre `properties/workflow` → `sources/batch-source`.
- O `PropertiesPanel` precisa mostrar o formulário do bloco Fonte (`sources/source-block`), do grupo (`groups`) e da fonte do lote. A 0052 proíbe `properties` de importar `sources` fora de `properties/workflow`.

## Decisão

- **Novo sentido permitido:** `canvas` → `sources/batch-source`, só por `sources/batch-source/index.ts`. Não há volta (`sources/batch-source` não importa o canvas), então não cria ciclo.
- **Ordem completa dos sentidos do canvas:** `unit-run` (0057), `groups` e `sources/batch-source`. Outras sub-verticais não entram sem ADR nova.
- **`PropertiesPanel` não importa `sources/source-block`, `groups` nem `sources/batch-source`.** O `Editor.tsx` monta e entrega as peças por render props, no mesmo padrão do `decisionTable`:
  - `sourceBlock(node)`, `group(node)`, `batchSource()` (item `inputs` selecionado, com fonte do lote) e `renderFilters` (o `FilterList`, adaptado a `BatchSourceFiltersProps`).
- Nova peça de outra sub-vertical no painel entra como render prop montada no `Editor.tsx`, não como import. A exceção da 0052 (`properties/workflow`) continua como está.

## Alternativas consideradas

- **Ampliar a 0052 para `properties` importar `sources/source-block` e `groups`:** abre um ciclo a mais e a 0052 pede ADR nova para isso; o padrão por render props já existia e basta.
- **Mover as peças comuns para uma pasta comum do editor agora:** resolve o ciclo, mas é trabalho grande, adiado desde a 0047.
- **Canvas receber a barra da fonte do lote por render props também:** a barra é parte fixa do desenho do canvas (portas `var:<nome>`, marca de problemas); passar por props só mudaria o import de lugar.

## Consequências

- **Bom:** sem ciclo novo; o `eslint-plugin-boundaries` segue verde; o painel continua sem conhecer as outras sub-verticais.
- **Ruim:** o `Editor.tsx` concentra a montagem e cresce a cada peça nova; alguns padrões ficam duplicados (`producedNames` e `allNodes` em `properties/definition.ts`, e os padrões do `newSourceBlock` em relação a `sources/source-block/sourceNode.ts`, que não está no `index.ts`).
- **A fazer:** no checkpoint, junto da pasta comum prevista na 0047 e na 0052, avaliar exportar essas utilidades e tirar as duplicações.
