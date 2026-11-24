# 0069. Os formatadores de número e data no padrão brasileiro ficam em `design-system/format/`

- **Status:** aceita
- **Data:** 2026-11-22
- **Quem decidiu:** sessão global (tarefa F115)
- **Relacionadas:** ADRs 0003, 0056, 0062; `packages/react/src/design-system/format/`

## Contexto

`readBrazilianNumber`, `formatApiNumber` e `formatDate` (e o `formatDateTime`) existiam em duas cópias: `editor/values/` (ADR 0056) e `executions/parameter-form/`. O `design-system` não importa ninguém e qualquer vertical pode importá-lo (ADR 0003). O editor não podia importar o interior de `executions/`, e `executions/` nunca importa o editor (ADR 0062), então cada lado ficou com a sua cópia, e as duas podiam divergir.

## Decisão

- A leitura e a formatação de número e data no padrão brasileiro (`readBrazilianNumber`, `formatApiNumber`, `formatDate`, `formatDateTime`) têm uma definição só, em `design-system/format/`, exportada por `design-system/index.ts`.
- Só texto: um valor de cálculo nunca vira `number` (E4-4).
- `editor/values/` e `executions/parameter-form/` importam de lá, sem cópia. Os dois `index.ts`/`literals.ts` reexportam os nomes só para não mexer nos imports dos vizinhos; não definem nada.
- Os rótulos dos padrões relativos (`RELATIVE_LABELS`) ficam só em `executions/parameter-form/labels.ts`, exportados por `executions/index.ts`; o editor os importa por ali (sentido editor → executions, E6-16).

## Alternativas consideradas

- **Manter as duas cópias:** é o que havia; o risco é uma regra de leitura mudar num lado só.
- **Exportar de `editor/values/` para `executions/`:** inverte o sentido da ADR 0062.
- **Uma vertical nova `format/`:** pede tarefa e ADR próprias para algo que é visual e sem estado; o `design-system` já é a vertical compartilhada.

## Consequências

- **Bom:** uma regra só para o número e a data digitados e mostrados; qualquer vertical os usa.
- **Ruim:** o `design-system` passa a ter lógica de texto, não só visual; deve ficar restrito a formatação pura.
- **A fazer:** quando as tarefas vizinhas permitirem, trocar os imports dos reexports (`editor/values`, `parameter-form/literals`) pelo `design-system` e remover os reexports.
