# 0065. `formula/index.ts` exporta as leituras de parâmetro e a lista de sugestões, e os filtros as usam

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-22
- **Quem decidiu:** orquestração (tarefa F99)
- **Relacionadas:** design.md E4-21, E6-18; ADRs 0003, 0041, 0042, 0055; `packages/react/src/formula/index.ts`, `packages/react/src/editor/sources/filters/`

## Contexto

A F99 põe `@parametro` na fórmula e nos valores dos filtros. Os filtros (`editor/sources/filters`) precisam das mesmas regras que a fórmula: ler a referência (`@nome`, `@periodo.inicio`), achar o parâmetro no rascunho, mostrar o tipo e listar sugestões num campo de texto. Antes, o `formula/index.ts` exportava só o `FormulaEditor`, e a única dependência era `editor` -> `formula` (`CalculationProperties`). Agora uma sub-vertical do editor, a de fontes, também passa a depender da `formula`. Pela ADR 0003, isso só pode ser pelo `index.ts`.

## Decisão

- `formula/index.ts` exporta, além do `FormulaEditor`:
  - leituras de parâmetro: `parameterReferences`, `readParameterReference`, `findParameter`, `parameterTypeLabel`, `PERIOD_PARTS` e o tipo `WorkflowParameter`;
  - lista de sugestões de campo de texto: `SuggestionList`, `suggestionId` e `useSuggestionKeys`.
- O `editor` (inclusive `editor/sources/filters`) importa essas peças, e só elas, pelo `formula/index.ts`. O sentido é `editor` -> `formula`. A `formula` não importa o editor.
- A regra de como se escreve um nome de parâmetro fica num lugar só: `NAME_SOURCE` e `NAME_CHAR_CLASS` em `formula/parameters.ts`, usados pelo realce (`language.ts`), pelo autocomplete e pelos filtros. Quem precisar do nome usa essas constantes, não copia a expressão regular.
- Outra peça da `formula` usada pelo editor entra no `index.ts` do mesmo jeito, uma linha por vez, com a tarefa que a pediu registrada no relatório.

## Alternativas consideradas

- **Copiar as leituras e a lista de sugestões nos filtros:** duas regras de nome e duas listas para manter, e o realce, o autocomplete e a ajuda dos filtros passam a discordar.
- **Importar `formula/parameters.ts` direto:** fere a ADR 0003 e o lint.
- **Mover as leituras para uma pasta comum fora das duas verticais:** mais arquivos movidos sem ganho agora. Pode voltar a ser avaliado se uma terceira vertical precisar delas.
- **Filtros receberem as peças por props:** liga cada tela do editor a detalhes da fórmula, sem ganho (compare com a 0055).

## Consequências

- **Bom:** uma regra de nome, uma leitura de referência e uma lista de sugestões para a fórmula e para os filtros.
- **Ruim:** o `index.ts` da `formula` cresce. Mudar a assinatura dessas peças exige olhar os filtros. Testes que trocam a `formula` inteira por um mock só com o `FormulaEditor` quebram quando renderizam um valor de filtro; eles devem espalhar o módulo original (`importOriginal`).
- **A fazer:** `BatchSourceBar.test.tsx`, `BatchSourceProperties.test.tsx`, `RecordsOrigin.test.tsx` e `WorkflowProperties.test.tsx` mockam `../formula` assim. Hoje passam. Se passarem a renderizar um filtro, ajustar o mock.
