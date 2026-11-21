# 0052. `properties/workflow` pode importar `sources/batch-source/index.ts`, com ciclo permitido entre as duas

- **Status:** aceita, revisar no checkpoint (complementada por [0059](0059-canvas-importa-sources-batch-source-e-propriedades-por-render-props.md): o canvas também importa `sources/batch-source`, e o painel recebe o resto por render props)
- **Data:** 2026-11-21
- **Quem decidiu:** orquestração (tarefa F63)
- **Relacionadas:** ADRs 0003, 0009, 0042, 0047; `packages/react/src/editor/properties/workflow/`, `packages/react/src/editor/sources/batch-source/`

## Contexto

A ADR 0047 deixa `sources/batch-source` importar peças de `properties/index.ts`. Na F63, o painel do workflow (`properties/workflow`) precisa mostrar as propriedades da fonte do lote, que vivem em `sources/batch-source`. Surge o sentido inverso, `properties` -> `sources`, que a 0047 não cobre. Os dois lados formam um ciclo de módulos. O `eslint-plugin-boundaries` não acusa, porque seus elementos são o primeiro nível (`editor`), e o lint passa. Nenhum lado usa o outro no carregamento do módulo, só ao renderizar.

## Decisão

- `properties/workflow` pode importar de `sources/batch-source/index.ts`, e só dele (ADR 0003).
- O ciclo `properties` <-> `sources/batch-source` é aceito, com estas regras:
  - nenhum dos dois lados usa o import do outro no carregamento do módulo (nada de constante ou chamada no topo do arquivo que dependa do outro);
  - esse sentido vale só para `properties/workflow` e `sources/batch-source`. Outras sub-verticais não ganham o sentido `properties` -> `sources` sem ADR nova.
- Se o ciclo incomodar (erro de carregamento, terceira sub-vertical no ciclo), as peças comuns vão para uma pasta comum do editor, como a 0047 já prevê.

## Alternativas consideradas

- **Mover agora as peças de `properties` para uma pasta comum:** resolve o ciclo, mas é trabalho grande e fora da posse da F63; a 0047 já adiou isso.
- **Injetar a fonte do lote no painel por props (`renderBatchSource`):** evitaria o import, mas o painel do workflow precisaria de uma ligação extra no `PropertiesPanel`, e a fonte do lote é parte fixa do painel.
- **Pôr a fonte do lote dentro de `properties/`:** apaga a fronteira da sub-vertical `sources`, que a barra do canvas (F69) também usa.

## Consequências

- **Bom:** o painel do workflow mostra a fonte do lote sem duplicar campos.
- **Ruim:** ciclo de módulos entre duas sub-verticais; trocar assinatura de um lado exige olhar o outro.
- **A fazer:** no checkpoint, avaliar a pasta comum de peças do editor (0047). Se aparecer erro de ordem de carregamento, mover antes.
