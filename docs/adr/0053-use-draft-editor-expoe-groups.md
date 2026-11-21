# 0053. `useDraftEditor()` expõe `groups`, o Input derivado da análise (complementa a 0042)

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-21
- **Quem decidiu:** orquestração (tarefa F65)
- **Relacionadas:** ADRs 0003, 0042, 0044; D17 e D23 do plano

## Contexto

A F65 desenha o Input de cada grupo, que é derivado da análise (E5-19). O contrato (B90) traz `groups` (`GroupInterface[]`) na análise, no salvamento e no Recarregar. O `DraftEditorProvider` descartava esse campo, e o front não pode derivar o Input das fórmulas. A D17 já tinha feito o mesmo caminho com `dependencies` e `order`. A D23 ratificou a mudança de 15 linhas em `editor/draft/` (`DraftEditor.tsx`, `queries.ts`, `index.ts`).

## Decisão

- O `DraftEditorProvider` guarda `groups` da análise, do salvamento e do Recarregar.
- O `useDraftEditor()` passa a expor `groups: GroupInterface[]`, e `editor/draft/index.ts` exporta o tipo `GroupInterface`.
- Quem precisa do Input ou do Output de um grupo lê de `groups`; nenhuma sub-vertical recalcula isso a partir das fórmulas.
- Vale o resto da 0042: sem análise ainda, `groups` fica vazio e o Input do grupo aparece vazio até a próxima análise.

## Alternativas consideradas

- **Derivar o Input no front, pelas fórmulas:** reimplementa a linguagem, que o front nunca faz (plano, épico 4).
- **Cada sub-vertical buscar a análise por conta própria:** contraria a 0042 (um acesso só ao rascunho).

## Consequências

- **Bom:** o Input derivado muda junto com a análise, sem lógica nova no front.
- **Ruim:** mais um campo no contexto, que todas as sub-verticais enxergam.
- **A fazer:** novos campos do contrato que a tela precisa entram aqui por ADR complementar, como esta.
