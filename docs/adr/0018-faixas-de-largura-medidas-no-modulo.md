# 0018. Faixas de largura medidas na largura do módulo (ResizeObserver), não na janela

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F8)
- **Relacionadas:** [0002](0002-pacote-react-sem-iframe.md), [0011](0011-tokens-raiz-e-portais-do-modulo.md)

## Contexto

O layout muda abaixo de 1180px. O hospedeiro decide a largura do módulo (estilos.md §15) e a ADR 0002 proíbe depender da janela inteira. Os épicos seguintes têm outras faixas (1180–1280 no editor).

## Decisão

- Faixas de largura são medidas na largura do próprio módulo com `ResizeObserver` (hook `useLarguraEstreita`).
- Não usamos `@media` da janela.
- Não usamos `@container` por enquanto: o teste `sem-estilo-global` do design-system reprova regras que não conhece.
- As faixas dos épicos seguintes seguem este padrão.

## Alternativas consideradas

- **`@media`:** mede a janela, errado quando o módulo está numa coluna do hospedeiro.
- **`@container`:** certo em princípio, mas bloqueado pelo teste do design-system.

## Consequências

- **Bom:** o layout responde ao espaço real do módulo.
- **Ruim:** depende de JavaScript (primeira renderização pode usar a faixa padrão); cada faixa nova precisa de hook e teste.
- **A fazer:** reavaliar `@container` se o teste do design-system passar a aceitá-lo.
