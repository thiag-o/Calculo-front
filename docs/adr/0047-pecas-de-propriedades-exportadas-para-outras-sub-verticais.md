# 0047. Outras sub-verticais do editor podem importar peças de `properties/index.ts`

- **Status:** aceita, revisar no checkpoint (complementada por [0052](0052-properties-workflow-importa-sources-batch-source.md))
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F53)
- **Relacionadas:** ADRs 0003, 0009, 0042; `packages/react/src/editor/properties/index.ts`

## Contexto

A ADR 0042 define que as sub-verticais do editor falam com o rascunho só por `useDraftEditor()` e `useProblemCounts()`. Ela não diz se uma sub-vertical pode usar componentes de outra. A F53 (propriedades) criou campos prontos com regras de acessibilidade, erro e foco, e a propriedade da Tabela (F54) tem os mesmos campos. Copiar essas peças duplicaria regra.

## Decisão

- `editor/properties/index.ts` exporta, como contrato para outras sub-verticais do editor:
  - `PropertiesFrame`, `CommitTextField`, `PathSelect`, `RoundingModeField`, `ErrorPolicyField`, `SegmentedControl`;
  - `useFocusOnSelection`;
  - `analyzedNodePath`, `problemsAt` e `otherProblems`.
- Outras sub-verticais importam só pelo `index.ts`, nunca pelos arquivos internos (ADR 0003).
- O `itemIdentity.ts` e as funções de edição da definição ficam privados de `properties`. O `WeakMap` de chaves de item é só de `properties`; quem precisar do mesmo padrão (ADR 0044) cria o seu ou propõe exportar por ADR complementar.
- Mudar a assinatura dessas peças exige conferir quem as usa (F54 e a montagem do `<PropertiesPanel decisionTable>` na F57).

## Alternativas consideradas

- **Copiar as peças na grade:** duplica regras de acessibilidade e de erro, e elas desandam com o tempo.
- **Mover as peças para uma pasta comum do editor:** boa ideia se mais de duas sub-verticais usarem; por ora só a F54 usa, e mover agora é trabalho sem uso.
- **Exportar também o `itemIdentity.ts`:** ninguém fora de `properties` precisa dele hoje.

## Consequências

- **Bom:** campos iguais em todo o editor, com uma regra só.
- **Ruim:** `properties` passa a ter dependentes; a F54 depende dela para os campos.
- **A fazer:** se o uso passar de duas sub-verticais, mover as peças para uma pasta comum do editor por ADR nova.
